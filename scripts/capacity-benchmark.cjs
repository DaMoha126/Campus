#!/usr/bin/env node
// Explicit, bounded loopback-only benchmark. Never invoked by node --test.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { spawn } = require('node:child_process'), net = require('node:net');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'capacity-results.json'), markdown = path.join(root, 'capacity-results.md');
const report = { generatedAt: new Date().toISOString(), scope: 'Isolated temporary local PocketBase; fictitious data only', expectedPerSchool: { students: 1600, classes: 40, subjects: 10, assignments: 400, evaluations: 1200, grades: 48000, attendance: 1600, payments: 1600 }, measuredRequests: 0, checks: [], measurements: [], errors: [], thresholds: { sequentialP95Ms: 2000, concurrency10P95Ms: 5000, note: 'Indicative references, not a production SLA; p95 at small sample size is only descriptive.' } };
let dir, proc, logs = '', base, password;
const progress = message => console.log('[capacity ' + new Date().toISOString() + '] ' + message);
const isRunning = child => Boolean(child && child.pid && child.exitCode === null && child.signalCode === null);
const loadLimits = { responseBytesPerWave: 128 * 1024 * 1024, maxRssBytes: 768 * 1024 * 1024, extendedP95Ms: 5000, allow1000: process.env.ETUDIA_CAPACITY_ALLOW_1000 === '1' };
report.loadLimits = loadLimits; report.loadStops = [];

const delay = ms => new Promise(r => setTimeout(r, ms));
const check = (name, condition, detail = '') => { report.checks.push({ name, passed: Boolean(condition), detail }); if (!condition) throw Error('Check failed: ' + name); };
function command(binary, args, timeout = 900000) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd: dir, env: { ...process.env, ETUDIA_DEMO: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', b => output = (output + b).slice(-10000)); child.stderr.on('data', b => output = (output + b).slice(-10000));
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Error('Initialization exceeded 15 minutes')); }, timeout);
    child.on('error', e => { clearTimeout(timer); reject(e); }); child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(Error('PocketBase initialization failed (exit ' + code + '): ' + output.replaceAll(password, '[redacted]'))); });
  });
}
async function request(route, token, body, timeout = 30000) {
  const began = performance.now();
  try {
    const response = await fetch(base + '/api/' + route, { method: body ? 'POST' : 'GET', headers: { ...(token ? { Authorization: token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout) });
    const text = await response.text();
    let data, parseError; try { data = JSON.parse(text); } catch { parseError = 'InvalidJSON'; }
    return { status: response.status, ms: performance.now() - began, bytes: Buffer.byteLength(text), data, ...(parseError ? { error: parseError } : {}) };
  } catch (error) { return { status: 0, ms: performance.now() - began, bytes: 0, error: error.name }; }
}
async function login(identity, superuser = false) {
  // Retain production rate limits. Back off only during fixture authentication,
  // outside measured workloads; never weaken throttling in the application.
  for (let attempt = 0; attempt < 13; attempt++) {
    const result = await request('collections/' + (superuser ? '_superusers' : 'school_users') + '/auth-with-password', '', { identity, password });
    if (result.status === 429 && attempt < 12) {
      report.authenticationBackoffs = (report.authenticationBackoffs || 0) + 1;
      await delay(5000);
      continue;
    }
    if (result.status !== 200 || !result.data?.token) throw Error('Representative login failed: ' + (superuser ? 'root' : identity) + ' status ' + result.status);
    return result.data.token;
  }
}
async function stop() {
  const child = proc;
  if (!isRunning(child)) { proc = null; return; }
  progress('Stopping temporary PocketBase');
  await new Promise((resolve, reject) => {
    let forceTimer;
    const finish = error => {
      clearTimeout(graceTimer); clearTimeout(forceTimer);
      child.removeListener('exit', onExit); child.removeListener('error', onError);
      if (!isRunning(child)) proc = null;
      error ? reject(error) : resolve();
    };
    const onExit = () => finish(), onError = () => finish(Error('Temporary PocketBase stop failed'));
    child.once('exit', onExit); child.once('error', onError);
    const graceTimer = setTimeout(() => {
      child.kill('SIGKILL');
      forceTimer = setTimeout(() => finish(isRunning(child) ? Error('Temporary PocketBase did not stop after SIGKILL') : undefined), 3000);
    }, 5000);
    if (!isRunning(child)) finish(); else child.kill('SIGTERM');
  });
}
async function start(binary, args, port) {
  progress('Starting temporary PocketBase on loopback');
  let startupError;
  logs = ''; proc = spawn(binary, ['serve', '--http=127.0.0.1:' + port, ...args], { cwd: dir, env: { ...process.env, ETUDIA_DEMO: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout.on('data', b => logs = (logs + b).slice(-10000)); proc.stderr.on('data', b => logs = (logs + b).slice(-10000));
  proc.on('error', () => { startupError = true; });
  for (let i = 0; i < 200; i++) { const r = await request('health', '', undefined, 1000); if (r.status === 200) { progress('Temporary PocketBase healthy'); return; } if (startupError || !isRunning(proc)) throw Error('PocketBase stopped during startup'); await delay(100); }
  throw Error('PocketBase startup timeout');
}
function validateState(data, school, role, student, page = "full") {
  if (!data || data.school?.id !== school.school || data.me?.role !== role) return false;
  const studentIds = new Set(school.allStudents), classIds = new Set(school.allClasses),
    subjectIds = new Set(school.allSubjects), teacherIds = new Set(school.allTeachers),
    enrollmentIds = new Set(school.allEnrollments), assignmentIds = new Set(school.allAssignments),
    peopleIds = new Set([...school.allStudents, ...school.allTeachers, school.admin]);
  if ((data.people || []).some(x => !peopleIds.has(x.id))) return false;
  if ((data.classes || []).some(x => !classIds.has(x.id))) return false;
  if ((data.subjects || []).some(x => !subjectIds.has(x.id))) return false;
  if ((data.assignments || []).some(x => !assignmentIds.has(x.id) || !classIds.has(x.classroom) || !subjectIds.has(x.subject) || !teacherIds.has(x.teacher))) return false;
  const visibleAssignments = new Set((data.assignments || []).map(x => x.id));
  if ((data.evaluations || []).some(x => !visibleAssignments.has(x.assignment))) return false;
  const evaluationIds = new Set((data.evaluations || []).map(x => x.id));
  if ((data.grades || []).some(x => !studentIds.has(x.student) || !evaluationIds.has(x.evaluation) || (role === 'student' && x.student !== student))) return false;
  if ((data.enrollments || []).some(x => !enrollmentIds.has(x.id) || !studentIds.has(x.student_id) || !classIds.has(x.class_id) || (role === 'student' && x.student_id !== student))) return false;
  const visibleEnrollmentIds = new Set((data.enrollments || []).map(x => x.id));
  if ((data.payments || []).some(x => !visibleEnrollmentIds.has(x.enrollment_id) || x.recorded_by !== school.admin || x.amount !== 10000)) return false;
  if ((data.attendance || []).some(x => !studentIds.has(x.student) || !assignmentIds.has(x.assignment) || (role === 'student' && x.student !== student))) return false;
  if (role === 'teacher') return data.me.id === school.teacher && data.assignments.length === 40 && data.assignments.every(x => x.teacher === school.teacher);
  const wanted = key => page === 'full' || (page === 'overview' ? ['attendance'] : ['evaluations', 'grades', 'reportRanks']).includes(key);
  const counts = role === 'administrator' ? { evaluations: page === 'reports' ? 30 : 1200, grades: page === 'reports' ? 1200 : 48000, attendance: page === 'overview' ? 0 : 1600, payments: 1600 } : { evaluations: 30, grades: 30, attendance: 1, payments: 1 };
  for (const [key, count] of Object.entries(counts)) if (!Array.isArray(data[key]) || data[key].length !== (wanted(key) ? count : 0)) return false;
  if (role === 'administrator') return data.me.id === school.admin && data.people.filter(x => x.role === 'student').length === (page === 'overview' ? 0 : 1600) && (page !== 'overview' || (data.enrollments.length === 0 && data.overviewCounts?.unjustifiedAttendance === 1600)) && data.classes.length === 40 && data.subjects.length === 10 && data.assignments.length === 400;
  if (wanted('reportRanks') && (!Array.isArray(data.reportRanks) || data.reportRanks.length !== 1 || data.reportRanks.some(x => x.student !== student || x.class_size !== 40 || x.rank < 1 || x.rank > 40))) return false;
  return data.me.id === student && data.classes.length === 1 && data.enrollments.length === 1;

}
function summary() {
  const lines = ['# Étudia — isolated capacity benchmark', '', report.scope, '', 'Two establishments × 1,600 fictitious pupils; no requests to a public service.', '', `Seed: ${report.seedMs ?? 'not completed'} ms. SQLite: ${report.sqliteBytes ?? 'unknown'} bytes.`, '', '## Created volumes', '', '```json', JSON.stringify(report.volumes || {}, null, 2), '```', '', 'Correctness passed: ' + Boolean(report.passed) + '. Indicative performance references met: ' + String(report.performanceReferencesMet ?? 'not completed') + '.', '', 'Scoped-screen performance references met: ' + String(report.scopedPerformanceReferencesMet ?? 'not completed') + '. Full/export measurements remain separate in the table.', '', 'Disposable-server recovery restarts after a stopped workload: ' + (report.workloadRecoveryRestarts || 0), '', 'Authentication backoffs (outside measurements, rate limits retained): ' + (report.authenticationBackoffs || 0), '', '## Correctness', ...report.checks.map(c => `- ${c.passed ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ': ' + c.detail : ''}`), '', '## GET /api/etudia/state', '', '| School | Role | Page | Concurrency | Samples | HTTP 200 | p50 ms | p95 ms | Max ms | Max bytes |', '|---|---|---|---:|---:|---:|---:|---:|---:|---:|', ...report.measurements.map(m => `| ${m.school} | ${m.role} | ${m.page} | ${m.concurrency} | ${m.samples} | ${m.http200} | ${m.p50Ms} | ${m.p95Ms} | ${m.maxMs} | ${m.maxBytes} |`), '', 'Reports use the class scope used by the interface (1200 grades for an administrator, 30 own grades for a pupil). Separate scenarios wait out the configured rate-limit window, without disabling rate limits. Full/export is measured at concurrency 1/5/10 only. Overview and reports are measured at 1/5/10 then 50/100 only after healthy previous stages; 1000 is opt-in and not enabled by CI. A resource-budget stop is not evidence of passing the skipped stage.', '', 'Student waves reuse a pool of 10 authenticated fictitious pupil accounts (distinct accounts at concurrency 1/5/10). Higher waves measure simultaneous API requests, not that many distinct users. Administrator concurrency reuses one administrator account. No real service receives these requests.', '', '## Load escalation stops', ...report.loadStops.map(x => '- ' + x), '', 'Latency references: sequential p95 ≤2 s; concurrency 10 p95 ≤5 s. These are indicative, not an SLA. CI runner performance does not establish production capacity. No long-duration or browser rendering benchmark is included.', '', ...report.errors.map(e => '- ERROR: ' + e)];
  return lines.join('\n') + '\n';
}
(async () => {
  try {
    const binary = process.env.POCKETBASE_BIN;
    if (!binary || !fs.existsSync(binary)) throw Error('POCKETBASE_BIN must point to an installed PocketBase executable');
    password = crypto.randomBytes(32).toString('hex'); dir = fs.mkdtempSync(path.join(os.tmpdir(), 'etudia-capacity-')); fs.chmodSync(dir, 0o700);
    for (const [source, dest] of [['pocketbase/pb_hooks', 'hooks'], ['pocketbase/pb_migrations', 'migrations']]) fs.cpSync(path.join(root, source), path.join(dir, dest), { recursive: true });
    fs.copyFileSync(path.join(root, 'support/capacity-seed.cjs'), path.join(dir, 'hooks/capacity-seed.cjs'));
    fs.writeFileSync(path.join(dir, 'hooks/capacity-config.cjs'), 'module.exports=' + JSON.stringify({ password }) + ';', { mode: 0o600 });
    fs.writeFileSync(path.join(dir, 'migrations/1999999900_capacity_fixture.js'), 'migrate((app)=>require(__hooks+"/capacity-seed.cjs").seed(app,require(__hooks+"/capacity-config.cjs")),()=>{});');
    const args = ['--dir=' + path.join(dir, 'data'), '--migrationsDir=' + path.join(dir, 'migrations'), '--hooksDir=' + path.join(dir, 'hooks'), '--dev=false', '--automigrate=false'];
    progress('Seeding 2 schools, 3200 pupils and 96000 grades (up to 15 minutes)');
    const began = performance.now(); await command(binary, ['migrate', 'up', ...args]); report.seedMs = Math.round(performance.now() - began);
    progress('Seed completed in ' + report.seedMs + ' ms');
    await command(binary, ['superuser', 'create', 'capacity-root@capacity.invalid', password, ...args], 30000);
    const port = await new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const p = server.address().port; server.close(() => resolve(p)); }); });
    base = 'http://127.0.0.1:' + port; await start(binary, args, port);
    let rootToken = await login('capacity-root@capacity.invalid', true);
    const settings = await request('settings', rootToken);
    check('production rate limits retained', settings.status === 200 && settings.data?.rateLimits?.enabled);
    report.rateLimits = settings.data.rateLimits;
    const generalRules = (report.rateLimits.rules || []).filter(rule => !String(rule.label).includes('auth') && Number(rule.duration) > 0);
    const cooldownMs = Math.max(1000, ...generalRules.map(rule => Number(rule.duration) * 1000 + 100));
    if (cooldownMs > 60000) throw Error('Configured rate-limit window exceeds bounded benchmark cooldown');
    report.scenarioCooldownMs = cooldownMs;
    const manifestResponse = await request('collections/capacity_manifest/records?perPage=1', rootToken);
    const manifest = manifestResponse.data?.items?.[0]?.payload; check('two isolated schools seeded', Array.isArray(manifest) && manifest.length === 2);
    report.volumes = [];
    const counts = async () => { const result = {}; for (const name of ['establishments', 'school_users', 'classes', 'subjects', 'enrollments', 'evaluations', 'school_grades', 'attendance', 'payments']) { const r = await request('collections/' + name + '/records?perPage=1', rootToken); if (r.status !== 200) throw Error('Count query failed: ' + name); result[name] = r.data.totalItems; } return result; };
    const before = await counts(); report.volumes = before;
    check('seed volumes exact', before.establishments === 2 && before.school_users === 3222 && before.classes === 80 && before.subjects === 20 && before.enrollments === 3200 && before.evaluations === 2400 && before.school_grades === 96000 && before.attendance === 3200 && before.payments === 3200);
    for (let i = 0; i < manifest.length; i++) {
      const school = manifest[i], adminToken = await login(school.emails.admin), teacherToken = await login(school.emails.teacher), studentTokens = [];
      progress('Authenticating school ' + (i + 1) + ' account pool outside measurements');
      for (const email of school.emails.students) studentTokens.push(await login(email));
      const teacher = await request('etudia/state', teacherToken); check('school ' + (i + 1) + ' teacher isolation', teacher.status === 200 && validateState(teacher.data, school, 'teacher'), JSON.stringify({ status: teacher.status, message: teacher.data?.message, counts: Object.fromEntries(['people', 'classes', 'assignments', 'enrollments', 'evaluations', 'grades', 'attendance', 'payments'].map(key => [key, teacher.data?.[key]?.length])) }));
      for (const role of ['administrator', 'student']) for (const page of ['full', 'overview', 'reports']) {
        const scenario = 'School ' + (i + 1) + ' ' + role + ' ' + page;
        progress(scenario + ': waiting ' + cooldownMs + ' ms outside measurement for rate-limit window');
        await delay(cooldownMs);
        const route = 'etudia/state' + (page === 'full' ? '' : '?page=' + page + (page === 'reports' ? '&classroom=auto' : '&compact=1'));
        let healthyBaselines = true, largestResponse = 0;
        const stages = page === 'full' ? [1, 5, 10] : [1, 5, 10, 50, 100, ...(loadLimits.allow1000 ? [1000] : [])];
        for (const concurrency of stages) {
          const extended = concurrency > 10;
          if (extended && !healthyBaselines) {
            report.loadStops.push(scenario + ': skipped concurrency ' + concurrency + ' after a failed or slow previous stage.');
            break;
          }
          if (extended && (largestResponse * concurrency > loadLimits.responseBytesPerWave || process.memoryUsage().rss > loadLimits.maxRssBytes)) {
            report.loadStops.push(scenario + ': stopped before concurrency ' + concurrency + ' to respect the local response-size/RSS budget.');
            break;
          }
          progress(scenario + ' wave ' + concurrency + ' API requests');
          const results = await Promise.all(Array.from({ length: concurrency }, (_, j) => {
            const studentIndex = j % studentTokens.length;
            return request(route, role === 'administrator' ? adminToken : studentTokens[studentIndex]).then(r => ({
              status: r.status, ms: r.ms, bytes: r.bytes, error: r.error,
              valid: r.status === 200 && validateState(r.data, school, role, school.students[studentIndex], page),
            }));
          }));
          report.measuredRequests += results.length;
          const times = results.map(x => x.ms).sort((a, b) => a - b), percentile = p => Math.round(times[Math.max(0, Math.ceil(times.length * p) - 1)]), valid = results.every(r => r.valid);
          const m = { school: i + 1, role, page, concurrency, distinctAccounts: role === 'administrator' ? 1 : Math.min(concurrency, studentTokens.length), samples: results.length, http200: results.filter(r => r.status === 200).length, statuses: results.map(x => x.status), errors: results.filter(x => x.error).map(x => x.error), p50Ms: percentile(.5), p95Ms: percentile(.95), maxMs: Math.round(times.at(-1)), maxBytes: Math.max(...results.map(x => x.bytes)), totalBytes: results.reduce((sum, r) => sum + r.bytes, 0), clientRssBytes: process.memoryUsage().rss, isolationAndCounts: valid };
          m.referenceP95Ms = concurrency === 1 ? 2000 : loadLimits.extendedP95Ms;
          m.performanceReferenceMet = m.http200 === m.samples && m.p95Ms <= m.referenceP95Ms;
          report.measurements.push(m); report.checks.push({ name: scenario + ' concurrency ' + concurrency + ' status/counts/isolation', passed: valid });
          progress(scenario + ' wave ' + concurrency + ': HTTP200 ' + m.http200 + '/' + m.samples + ', p95 ' + m.p95Ms + ' ms, integrity ' + valid);
          largestResponse = Math.max(largestResponse, m.maxBytes);
          healthyBaselines = healthyBaselines && m.performanceReferenceMet;
          if (!valid || (extended && !m.performanceReferenceMet) || m.totalBytes > loadLimits.responseBytesPerWave || m.clientRssBytes > loadLimits.maxRssBytes) {
            report.loadStops.push(scenario + ': stopped escalation after concurrency ' + concurrency + ' because of errors, slow extended requests, or resource budget.');
            // An aborted HTTP client does not cancel server work. Drain by restarting
            // only this disposable server before measuring the next scenario.
            await stop(); await start(binary, args, port);
            report.workloadRecoveryRestarts = (report.workloadRecoveryRestarts || 0) + 1;
            await delay(1000);
            break;
          }
          await delay(250);
        }
      }
      for (let j = 0; j < 5; j++) {
        const r = await request('etudia/action', adminToken, { operation: 'attendance', data: { assignment: school.assignment, student: school.students[j], held_on: '2026-10-15', status: 'late', minutes: 5, note: 'Capacity write verification' } });
        check('school ' + (i + 1) + ' attendance write ' + (j + 1), r.status === 200);
      }
      // Explicit foreign-school object access is denied by the normal collection rules.
      const other = manifest[1 - i]; const forbidden = await request('collections/classes/records?filter=' + encodeURIComponent('establishment_id="' + other.school + '"'), adminToken);
      check('school ' + (i + 1) + ' foreign school query empty', forbidden.status === 200 && forbidden.data.totalItems === 0);
      const foreignWrite = await request('etudia/action', adminToken, { operation: 'attendance', data: { assignment: other.assignment, student: other.students[0], held_on: '2026-10-16', status: 'absent' } });
      check('school ' + (i + 1) + ' foreign school attendance write denied', foreignWrite.status === 403);
    }
    progress('Checking write counts, tenant boundaries and persistence');
    const written = await counts(); check('ten own attendance writes, no foreign writes, before restart', written.attendance === before.attendance + 10);
    await stop(); await start(binary, args, port); rootToken = await login('capacity-root@capacity.invalid', true);
    const after = await counts(); report.afterRestart = after; check('restart preserves all collection counts including writes', JSON.stringify(after) === JSON.stringify(written));
    await stop(); report.sqliteBytes = fs.statSync(path.join(dir, 'data/data.db')).size;
    report.baselineComplete = manifest.every((_, i) => ['administrator', 'student'].every(role => ['full', 'overview', 'reports'].every(page => [1, 5, 10].every(concurrency => report.measurements.some(m => m.school === i + 1 && m.role === role && m.page === page && m.concurrency === concurrency)))));
    report.checks.push({ name: 'all required full/overview/reports 1/5/10 baseline measurements completed', passed: report.baselineComplete });
    report.performanceReferencesMet = report.baselineComplete && report.measurements.every(m => m.performanceReferenceMet);
    report.scopedPerformanceReferencesMet = report.measurements.filter(m => m.page !== 'full').every(m => m.performanceReferenceMet) && manifest.every((_, i) => ['administrator', 'student'].every(role => ['overview', 'reports'].every(page => report.measurements.some(m => m.school === i + 1 && m.role === role && m.page === page && m.concurrency === 10))));
    report.passed = report.checks.every(c => c.passed);
  } catch (error) { report.errors.push(String(error.message).replaceAll(password || '\0', '[redacted]')); report.passed = false; }
  finally {
    try { await stop(); } catch { report.errors.push('Temporary PocketBase cleanup did not complete'); report.passed = false; }
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); fs.writeFileSync(markdown, summary());
    if (dir && !isRunning(proc)) fs.rmSync(dir, { recursive: true, force: true });
    progress('Reports written; correctness ' + Boolean(report.passed)); console.log(summary()); if (!report.passed) process.exitCode = 1;
  }
})();

#!/usr/bin/env node
// Explicit, bounded loopback-only benchmark. Never invoked by node --test.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { spawn } = require('node:child_process'), net = require('node:net');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'capacity-results.json'), markdown = path.join(root, 'capacity-results.md');
const report = { generatedAt: new Date().toISOString(), scope: 'Isolated temporary local PocketBase; fictitious data only', expectedPerSchool: { students: 1600, classes: 40, subjects: 10, assignments: 400, evaluations: 1200, grades: 48000, attendance: 1600, payments: 1600 }, measuredRequests: 0, checks: [], measurements: [], errors: [], thresholds: { sequentialP95Ms: 2000, concurrency10P95Ms: 5000, note: 'Indicative references, not a production SLA; p95 at small sample size is only descriptive.' } };
let dir, proc, logs = '', base, password;
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
    if (result.status !== 200 || !result.data.token) throw Error('Representative login failed: ' + (superuser ? 'root' : identity) + ' status ' + result.status);
    return result.data.token;
  }
}
async function stop() {
  if (!proc || proc.exitCode !== null) return;
  const child = proc;
  await new Promise(resolve => { const timer = setTimeout(() => child.kill('SIGKILL'), 5000); child.once('exit', () => { clearTimeout(timer); resolve(); }); child.kill('SIGTERM'); });
  proc = null;
}
async function start(binary, args, port) {
  logs = ''; proc = spawn(binary, ['serve', '--http=127.0.0.1:' + port, ...args], { cwd: dir, env: { ...process.env, ETUDIA_DEMO: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout.on('data', b => logs = (logs + b).slice(-10000)); proc.stderr.on('data', b => logs = (logs + b).slice(-10000));
  proc.on('error', e => { logs += e.message; });
  for (let i = 0; i < 200; i++) { const r = await request('health', '', undefined, 1000); if (r.status === 200) return; if (proc.exitCode !== null) throw Error('PocketBase stopped during startup'); await delay(100); }
  throw Error('PocketBase startup timeout');
}
function validateState(data, school, role, student) {
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
  if ((data.payments || []).some(x => !enrollmentIds.has(x.enrollment_id))) return false;
  if ((data.attendance || []).some(x => !studentIds.has(x.student) || !assignmentIds.has(x.assignment) || (role === 'student' && x.student !== student))) return false;
  if (role === 'teacher') return data.me.id === school.teacher && data.assignments.length === 40 && data.assignments.every(x => x.teacher === school.teacher);
  if (role === 'administrator') return data.people.filter(x => x.role === 'student').length === 1600 && data.classes.length === 40 && data.subjects.length === 10 && data.assignments.length === 400 && data.evaluations.length === 1200 && data.grades.length === 48000 && data.attendance.length === 1600 && data.payments.length === 1600;
  return data.classes.length === 1 && data.enrollments.length === 1 && data.grades.length === 30 && data.attendance.length === 1 && data.payments.length === 1;
}
function summary() {
  const lines = ['# Étudia — isolated capacity benchmark', '', report.scope, '', 'Two establishments × 1,600 fictitious pupils; no requests to a public service.', '', `Seed: ${report.seedMs ?? 'not completed'} ms. SQLite: ${report.sqliteBytes ?? 'unknown'} bytes.`, '', '## Created volumes', '', '```json', JSON.stringify(report.volumes || {}, null, 2), '```', '', 'Correctness passed: ' + Boolean(report.passed) + '. Indicative performance references met: ' + String(report.performanceReferencesMet ?? 'not completed') + '.', '', 'Authentication backoffs (outside measurements, rate limits retained): ' + (report.authenticationBackoffs || 0), '', '## Correctness', ...report.checks.map(c => `- ${c.passed ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ': ' + c.detail : ''}`), '', '## GET /api/etudia/state', '', '| School | Role | Concurrency | Samples | HTTP 200 | p50 ms | p95 ms | Max ms | Max bytes |', '|---|---|---:|---:|---:|---:|---:|---:|---:|', ...report.measurements.map(m => `| ${m.school} | ${m.role} | ${m.concurrency} | ${m.samples} | ${m.http200} | ${m.p50Ms} | ${m.p95Ms} | ${m.maxMs} | ${m.maxBytes} |`), '', 'Student concurrency uses distinct pupil accounts. Administrator concurrency uses the same administrator account and represents simultaneous requests, not distinct staff users.', '', 'Latency references: sequential p95 ≤2 s; concurrency 10 p95 ≤5 s. These are indicative, not an SLA. CI runner performance does not establish production capacity. No long-duration or browser rendering benchmark is included.', '', ...report.errors.map(e => '- ERROR: ' + e)];
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
    const began = performance.now(); await command(binary, ['migrate', 'up', ...args]); report.seedMs = Math.round(performance.now() - began);
    await command(binary, ['superuser', 'create', 'capacity-root@capacity.invalid', password, ...args], 30000);
    const port = await new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const p = server.address().port; server.close(() => resolve(p)); }); });
    base = 'http://127.0.0.1:' + port; await start(binary, args, port);
    let rootToken = await login('capacity-root@capacity.invalid', true);
    const manifestResponse = await request('collections/capacity_manifest/records?perPage=1', rootToken);
    const manifest = manifestResponse.data?.items?.[0]?.payload; check('two isolated schools seeded', Array.isArray(manifest) && manifest.length === 2);
    report.volumes = [];
    const counts = async () => { const result = {}; for (const name of ['establishments', 'school_users', 'classes', 'subjects', 'enrollments', 'evaluations', 'school_grades', 'attendance', 'payments']) { const r = await request('collections/' + name + '/records?perPage=1', rootToken); if (r.status !== 200) throw Error('Count query failed: ' + name); result[name] = r.data.totalItems; } return result; };
    const before = await counts(); report.volumes = before;
    check('seed volumes exact', before.establishments === 2 && before.school_users === 3222 && before.classes === 80 && before.subjects === 20 && before.enrollments === 3200 && before.evaluations === 2400 && before.school_grades === 96000 && before.attendance === 3200 && before.payments === 3200);
    for (let i = 0; i < manifest.length; i++) {
      const school = manifest[i], adminToken = await login(school.emails.admin), teacherToken = await login(school.emails.teacher), studentTokens = [];
      for (const email of school.emails.students) studentTokens.push(await login(email));
      const teacher = await request('etudia/state', teacherToken); check('school ' + (i + 1) + ' teacher isolation', teacher.status === 200 && validateState(teacher.data, school, 'teacher'));
      for (const role of ['administrator', 'student']) for (const concurrency of [1, 5, 10]) {
        const results = await Promise.all(Array.from({ length: concurrency }, (_, j) => request('etudia/state', role === 'administrator' ? adminToken : studentTokens[j])));
        report.measuredRequests += results.length;
        const times = results.map(x => x.ms).sort((a, b) => a - b), percentile = p => Math.round(times[Math.max(0, Math.ceil(times.length * p) - 1)]);
        const valid = results.every((r, j) => r.status === 200 && validateState(r.data, school, role, school.students[j]));
        const m = { school: i + 1, role, concurrency, samples: results.length, http200: results.filter(r => r.status === 200).length, statuses: results.map(x => x.status), errors: results.filter(x => x.error).map(x => x.error), p50Ms: percentile(.5), p95Ms: percentile(.95), maxMs: Math.round(times.at(-1)), maxBytes: Math.max(...results.map(x => x.bytes)), isolationAndCounts: valid };
        m.referenceP95Ms = concurrency === 1 ? 2000 : 5000;
        m.performanceReferenceMet = m.http200 === m.samples && m.p95Ms <= m.referenceP95Ms;
        report.measurements.push(m); report.checks.push({ name: 'school ' + (i + 1) + ' ' + role + ' concurrency ' + concurrency + ' status/counts/isolation', passed: valid });
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
    const written = await counts(); check('ten own attendance writes, no foreign writes, before restart', written.attendance === before.attendance + 10);
    await stop(); await start(binary, args, port); rootToken = await login('capacity-root@capacity.invalid', true);
    const after = await counts(); report.afterRestart = after; check('restart preserves all collection counts including writes', JSON.stringify(after) === JSON.stringify(written));
    await stop(); report.sqliteBytes = fs.statSync(path.join(dir, 'data/data.db')).size;
    report.performanceReferencesMet = report.measurements.every(m => m.performanceReferenceMet);
    report.passed = report.checks.every(c => c.passed);
  } catch (error) { report.errors.push(String(error.message).replaceAll(password || '\0', '[redacted]')); report.passed = false; }
  finally { await stop(); fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); fs.writeFileSync(markdown, summary()); if (dir) fs.rmSync(dir, { recursive: true, force: true }); console.log(summary()); if (!report.passed) process.exitCode = 1; }
})();

#!/usr/bin/env node
// Run on an external computer, never inside the monitored Render service.
const { setTimeout: delay } = require('node:timers/promises');

function configuration(env = process.env) {
  const url = new URL(env.ETUDIA_MONITOR_URL || 'https://etudia-demo.onrender.com/api/health');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/api/health')
    throw new Error('Utiliser une URL HTTPS /api/health sans identifiants ni paramètres.');
  const minutes = Number(env.ETUDIA_MONITOR_MINUTES || 2.5);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 10)
    throw new Error('L’intervalle doit être compris entre 1 et 10 minutes.');
  return { url: url.href, intervalMs: minutes * 60000 };
}

async function check(url, signal, fetcher = fetch) {
  const began = performance.now();
  try {
    const response = await fetcher(url, {
      method: 'GET', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
      headers: { 'User-Agent': 'Etudia-Demo-Monitor/1.0', Accept: 'application/json' },
    });
    let healthy = false;
    if (response.ok) {
      const data = await response.json();
      healthy = data?.code === 200 && data?.message === 'API is healthy.';
    } else await response.body?.cancel();
    return { healthy, status: response.status, elapsedMs: Math.round(performance.now() - began) };
  } catch (error) {
    return { healthy: false, error: signal.aborted ? 'Arrêt demandé' : error.name, elapsedMs: Math.round(performance.now() - began) };
  }
}

async function main() {
  const config = configuration(), controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const once = process.argv.includes('--once');
  try {
    console.log('Moniteur externe Étudia : un contrôle toutes les ' + config.intervalMs / 60000 + ' minutes. Ctrl+C pour arrêter.');
    do {
      const checkedAt = performance.now();
      const result = await check(config.url, controller.signal);
      if (controller.signal.aborted) break;
      console.log(new Date().toISOString() + ' — ' + (result.healthy ? 'API disponible' : 'API indisponible') +
        ' — ' + (result.status ? 'HTTP ' + result.status : result.error) + ' — ' + result.elapsedMs + ' ms');
      if (once) { process.exitCode = result.healthy ? 0 : 1; break; }
      // No overlapping requests or rapid retries on failure.
      await delay(Math.max(0, config.intervalMs - (performance.now() - checkedAt)), undefined, { signal: controller.signal });
    } while (!controller.signal.aborted);
  } catch (error) {
    if (!controller.signal.aborted) throw error;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

module.exports = { configuration, check };
if (require.main === module) main().catch(() => {
  console.error('Moniteur non démarré : vérifier la configuration et utiliser Node.js 24 ou plus récent.');
  process.exitCode = 1;
});

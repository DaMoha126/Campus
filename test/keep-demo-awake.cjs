const { test } = require('node:test');
const assert = require('node:assert/strict');
const { configuration, check } = require('../scripts/keep-demo-awake.cjs');

test('external monitor stays bounded and accepts only the health endpoint', () => {
  assert.equal(configuration({}).intervalMs, 300000);
  for (const url of ['http://example.com/api/health', 'https://x.invalid/api/etudia/state', 'https://user:secret@x.invalid/api/health', 'https://x.invalid/api/health?token=secret'])
    assert.throws(() => configuration({ ETUDIA_MONITOR_URL: url }));
  for (const minutes of ['0', '-1', '0.01', '11', 'NaN'])
    assert.throws(() => configuration({ ETUDIA_MONITOR_MINUTES: minutes }));
});

test('monitor distinguishes PocketBase health from loading pages and failures', async () => {
  const signal = new AbortController().signal;
  const run = (response) => check('https://demo.invalid/api/health', signal, async (_url, options) => {
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    return response;
  });
  assert.equal((await run(Response.json({ code: 200, message: 'API is healthy.' }))).healthy, true);
  assert.equal((await run(new Response('<html>Waking up</html>', { status: 200 }))).healthy, false);
  assert.equal((await run(new Response('Unavailable', { status: 503 }))).status, 503);
  const failed = await check('https://demo.invalid/api/health', signal, async () => { throw new TypeError('Private network error'); });
  assert.equal(failed.healthy, false);
  assert.equal(failed.error, 'TypeError');
});

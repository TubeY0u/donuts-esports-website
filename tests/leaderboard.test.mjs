import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { validate } from '../worker/leaderboard.js';

const kv = () => { const m = new Map(); return { get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); } }; };
const env = () => ({ SCORES: kv(), ADMIN_KEY: 'secret' });
const post = (e, body, ip = '1.1.1.1') => worker.fetch(new Request('https://w/scores', {
  method: 'POST', body: JSON.stringify(body),
  headers: { origin: 'https://donuts-esports.de', 'cf-connecting-ip': ip },
}), e);
const top = async (e, mode = 'classic') => (await worker.fetch(new Request('https://w/scores?mode=' + mode), e)).json();

test('validate rejects bad input and cheats', () => {
  assert.equal(typeof validate({ mode: 'classic', name: 'Lukas', level: 5, ms: 5000 }), 'object');
  for (const bad of [
    { mode: 'god', name: 'Lukas', level: 5, ms: 5000 },
    { mode: 'classic', name: 'x', level: 5, ms: 5000 },
    { mode: 'classic', name: '<script>', level: 5, ms: 5000 },
    { mode: 'classic', name: 'H1tler', level: 5, ms: 5000 },
    { mode: 'classic', name: 'Lukas', level: 500, ms: 999999 },
    { mode: 'classic', name: 'Lukas', level: 30, ms: 1000 },
    { mode: 'classic', name: 'Lukas', level: 5.5, ms: 5000 },
  ]) assert.equal(typeof validate(bad), 'string', JSON.stringify(bad));
});

test('keeps best per name, sorted, top 10, per mode', async () => {
  const e = env();
  await post(e, { mode: 'classic', name: 'Lukas', level: 5, ms: 9000 });
  await post(e, { mode: 'classic', name: 'lukas', level: 3, ms: 9000 }, '2.2.2.2');
  await post(e, { mode: 'classic', name: 'Dome', level: 7, ms: 9000 }, '3.3.3.3');
  assert.deepEqual(await top(e), [{ name: 'Dome', level: 7 }, { name: 'Lukas', level: 5 }]);
  assert.deepEqual(await top(e, 'smoke'), []);
  for (let i = 0; i < 12; i++) await post(e, { mode: 'classic', name: 'P' + i + 'x', level: 10 + i, ms: 99999 }, 'ip' + i);
  const list = await top(e);
  assert.equal(list.length, 10);
  assert.equal(list[0].level, 21);
});

test('rate limit, foreign origin and admin delete', async () => {
  const e = env();
  for (let i = 0; i < 6; i++) await post(e, { mode: 'classic', name: 'Spam' + i, level: 2, ms: 1000 });
  assert.equal((await post(e, { mode: 'classic', name: 'Spam9', level: 2, ms: 1000 })).status, 429);
  const foreign = await worker.fetch(new Request('https://w/scores', { method: 'POST', body: '{}', headers: { origin: 'https://evil.example' } }), e);
  assert.equal(foreign.status, 403);
  const del = u => worker.fetch(new Request('https://w/scores?mode=classic&name=spam0', { method: 'DELETE', headers: { authorization: 'Bearer ' + u } }), e);
  assert.equal((await del('wrong')).status, 401);
  assert.ok(!(await (await del('secret')).json()).some(x => x.name === 'Spam0'));
});

test('junk and non-top-10 entries cost no KV writes', async () => {
  const e = env(); let writes = 0;
  const put = e.SCORES.put; e.SCORES.put = async (k, v, o) => { writes++; return put(k, v, o); };
  for (let i = 0; i < 20; i++) assert.equal((await post(e, { mode: 'classic', name: 'x', level: 2, ms: 1 }, 'junk')).status, 400);
  assert.equal(writes, 0);
  for (let i = 0; i < 10; i++) await post(e, { mode: 'classic', name: 'Top' + i + 'x', level: 50, ms: 99999 }, 't' + i);
  writes = 0;
  await post(e, { mode: 'classic', name: 'Neuling', level: 3, ms: 99999 }, 'new');
  assert.equal(writes, 1); // nur der Rate-Limit-Zähler, die Rangliste bleibt unangetastet
});

test('CORS preflight answers 204 without body', async () => {
  const res = await worker.fetch(new Request('https://w/scores', { method: 'OPTIONS' }), env());
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://donuts-esports.de');
});

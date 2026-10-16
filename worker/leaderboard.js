// Clutch-Check Rangliste. Cloudflare Worker, KV-Binding "SCORES", Secret "ADMIN_KEY".
// GET    /scores?mode=classic                    -> Top 10 [{name, level}]
// POST   /scores {mode, name, level, ms}         -> trägt ein (beste Runde pro Name zählt)
// DELETE /scores?mode=classic&name=X  (Authorization: Bearer ADMIN_KEY) -> Eintrag löschen
const ORIGIN = 'https://donuts-esports.de';
const MODES = ['classic', 'smoke', 'flash', 'wobble', 'donut'];
const NAME_RE = /^[A-Za-z0-9ÄÖÜäöüß _.\-]{2,16}$/;
const BAD = ['hitler', 'nazi', 'nigg', 'fotze', 'hure', 'schlampe', 'wichser', 'fick', 'fuck', 'cunt', 'whore', 'slut', 'heil', 'sieg'];
const MAX_LEVEL = 80;
const MIN_MS_PER_LEVEL = 250; // ponytail: Plausibilität statt echter Anti-Cheat, ein Browserspiel ist nie fälschungssicher
const RATE = 6;               // Einträge pro Minute und IP

const json = (data, status = 200) => new Response(data === null ? null : JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': ORIGIN,
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'cache-control': 'no-store',
  },
});
const load = async (env, mode) => JSON.parse(await env.SCORES.get('top:' + mode) || '[]');
const save = (env, mode, list) => env.SCORES.put('top:' + mode, JSON.stringify(list));

export function validate(body) {
  if (!body || typeof body !== 'object') return 'Ungültige Daten.';
  const { mode, level, ms } = body;
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (!MODES.includes(mode)) return 'Unbekannter Modus.';
  if (!NAME_RE.test(name)) return 'Name: 2 bis 16 Zeichen, nur Buchstaben, Zahlen, Leerzeichen, _ . -';
  const flat = name.toLowerCase().replace(/[01345]/g, d => 'oieas'[[0,1,3,4,5].indexOf(+d)]).replace(/[^a-zäöüß]/g, '');
  if (BAD.some(w => flat.includes(w))) return 'Such dir bitte einen anderen Namen aus.';
  if (!Number.isInteger(level) || level < 2 || level > MAX_LEVEL) return 'Ungültiges Level.';
  if (!Number.isFinite(ms) || ms < (level - 1) * MIN_MS_PER_LEVEL) return 'Das war zu schnell, um echt zu sein.';
  return { mode, name, level };
}

export function insert(list, entry) {
  const i = list.findIndex(e => e.name.toLowerCase() === entry.name.toLowerCase());
  if (i >= 0 && list[i].level >= entry.level) return list; // alter Rekord ist besser
  if (i >= 0) list.splice(i, 1);
  list.push({ name: entry.name, level: entry.level, at: Date.now() });
  list.sort((a, b) => b.level - a.level || a.at - b.at); // Gleichstand: wer zuerst da war
  return list.slice(0, 10);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return json(null, 204);
    if (url.pathname !== '/scores') return json({ error: 'Nicht gefunden.' }, 404);
    const mode = url.searchParams.get('mode');

    if (req.method === 'GET') {
      if (!MODES.includes(mode)) return json({ error: 'Unbekannter Modus.' }, 400);
      return json((await load(env, mode)).map(({ name, level }) => ({ name, level })));
    }

    if (req.method === 'POST') {
      if (req.headers.get('origin') !== ORIGIN) return json({ error: 'Nicht erlaubt.' }, 403);
      const ip = req.headers.get('cf-connecting-ip') || 'x';
      const rlKey = 'rl:' + ip;
      const count = Number(await env.SCORES.get(rlKey)) || 0;
      if (count >= RATE) return json({ error: 'Kurz durchatmen, gleich nochmal.' }, 429);
      await env.SCORES.put(rlKey, String(count + 1), { expirationTtl: 60 });

      let body;
      try { body = JSON.parse(await req.text()); } catch { body = null; }
      const v = validate(body);
      if (typeof v === 'string') return json({ error: v }, 400);
      const list = insert(await load(env, v.mode), v);
      await save(env, v.mode, list);
      return json(list.map(({ name, level }) => ({ name, level })));
    }

    if (req.method === 'DELETE') {
      if (!env.ADMIN_KEY || req.headers.get('authorization') !== 'Bearer ' + env.ADMIN_KEY) return json({ error: 'Nicht erlaubt.' }, 401);
      if (!MODES.includes(mode)) return json({ error: 'Unbekannter Modus.' }, 400);
      const name = (url.searchParams.get('name') || '').toLowerCase();
      const list = (await load(env, mode)).filter(e => e.name.toLowerCase() !== name);
      await save(env, mode, list);
      return json(list.map(({ name, level }) => ({ name, level })));
    }

    return json({ error: 'Methode nicht erlaubt.' }, 405);
  },
};

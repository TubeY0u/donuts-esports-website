const KEY = process.env.FACEIT_API_KEY || '';
const HALFY = '024be859-e215-42dd-a7ed-18f7bbf91b3c';

async function dataApi(path) {
  const r = await fetch(`https://open.faceit.com/data/v4${path}`, {
    headers: { Authorization: `Bearer ${KEY}` } });
  return { status: r.status, body: await r.json().catch(() => null) };
}
function dump(label, obj) {
  console.log(`\n########## ${label} ##########`);
  console.log(JSON.stringify(obj, null, 1).slice(0, 8000));
}
(async () => {
  const s = await dataApi(`/search/teams?nickname=donuts&offset=0&limit=30`);
  // kompakt
  const teams = (s.body?.items || []).map(t => ({ id: t.team_id, name: t.name, game: t.game }));
  dump('search teams "donuts"', { status: s.status, teams });
  dump('halfy teams (v4 unofficial)', await dataApi(`/players/${HALFY}/teams?offset=0&limit=20`).then(r => ({
    status: r.status,
    teams: (r.body?.items || []).map(t => ({ id: t.team_id, name: t.name, game: t.game })) || r.body
  })));
})();

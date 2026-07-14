const KEY = process.env.FACEIT_API_KEY || '';
async function dataApi(path) {
  const r = await fetch(`https://open.faceit.com/data/v4${path}`, {
    headers: { Authorization: `Bearer ${KEY}` } });
  return { status: r.status, body: await r.json().catch(() => null) };
}
(async () => {
  // Teams aller Main/Nxt-Spieler aus stats.json
  const stats = require('./data/stats.json');
  const players = stats.allPlayers.filter(p => ['main','nxt'].includes(p.teamSlug));
  for (const p of players) {
    const r = await dataApi(`/players/${p.faceitId}/teams?offset=0&limit=20`);
    const teams = (r.body?.items || []).filter(t => t.game === 'cs2').map(t => `${t.team_id} ${t.name}`);
    console.log(`${p.nickname}: ${teams.join(' | ') || '-'}`);
    await new Promise(r => setTimeout(r, 150));
  }
  for (const q of ['diedonuts', 'die donuts']) {
    const s = await dataApi(`/search/teams?nickname=${encodeURIComponent(q)}&offset=0&limit=10`);
    console.log(`SEARCH ${q}:`, (s.body?.items || []).filter(t=>t.game==='cs2').map(t => `${t.team_id} ${t.name}`).join(' | '));
  }
})();

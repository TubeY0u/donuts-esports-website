const KEY = process.env.FACEIT_API_KEY || '';
async function dataApi(path) {
  const r = await fetch(`https://open.faceit.com/data/v4${path}`, {
    headers: { Authorization: `Bearer ${KEY}` } });
  return { status: r.status, body: await r.json().catch(() => null) };
}
(async () => {
  const m = await dataApi('/matches/1-caf95f65-4dc3-458e-8293-d304501beaa4');
  const b = m.body || {};
  console.log('MATCH:', JSON.stringify({
    status: m.status,
    competition_id: b.competition_id, competition_type: b.competition_type,
    competition_name: b.competition_name, organizer_id: b.organizer_id,
    scheduled_at: b.scheduled_at, region: b.region,
    teams: Object.fromEntries(Object.entries(b.teams || {}).map(([k,t]) => [k, { id: t.faction_id, name: t.name, roster: (t.roster||[]).map(p=>p.nickname) }]))
  }, null, 1));
  if (b.competition_id) {
    const c = await dataApi(`/championships/${b.competition_id}`);
    console.log('CHAMPIONSHIP:', JSON.stringify({ status: c.status, name: c.body?.name, type: c.body?.type, league: c.body?.league }, null, 1).slice(0,1500));
    const um = await dataApi(`/championships/${b.competition_id}/matches?type=upcoming&offset=0&limit=100`);
    const items = um.body?.items || [];
    console.log('UPCOMING total:', um.status, items.length);
    for (const it of items) {
      const ts = Object.values(it.teams||{});
      if (ts.some(t => /donut/i.test(t.name||''))) console.log('  DONUTS MATCH:', it.match_id, ts.map(t=>t.name).join(' vs '), it.scheduled_at);
    }
  }
})();

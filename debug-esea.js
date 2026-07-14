// Debug: Wo liegen die ESEA-Matches in der FACEIT-API?
const KEY = process.env.FACEIT_API_KEY || '';
const TEAMS = {
  main: '46c77ad9-8098-4c9c-a674-00a6a79a303e',
  nxt:  '5d25c833-2677-4c52-93e7-ce5699378a9a',
};

async function dataApi(path) {
  const r = await fetch(`https://open.faceit.com/data/v4${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

async function webApi(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
  return { status: r.status, body };
}

function dump(label, obj) {
  console.log(`\n########## ${label} ##########`);
  console.log(JSON.stringify(obj, null, 1).slice(0, 6000));
}

(async () => {
  for (const [slug, id] of Object.entries(TEAMS)) {
    dump(`${slug}: data-api /teams/{id}/tournaments`,
      await dataApi(`/teams/${id}/tournaments?offset=0&limit=20`));
    dump(`${slug}: web-api team-leagues v2 profile`,
      await webApi(`https://www.faceit.com/api/team-leagues/v2/teams/${id}/profile`));
    dump(`${slug}: web-api groupByState`,
      await webApi(`https://www.faceit.com/api/match/v1/matches/groupByState?participantId=${id}&participantType=TEAM`));
    dump(`${slug}: web-api team-leagues v1 summary`,
      await webApi(`https://www.faceit.com/api/team-leagues/v1/teams/${id}/leagues/a14b8616-45b9-4581-8637-4dfd0b5f6af8/summary`));
  }
})();

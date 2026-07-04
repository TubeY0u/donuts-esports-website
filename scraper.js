#!/usr/bin/env node
// ============================================================
//  DieDonuts Esports — Data Scraper  v3
//  Fetches FACEIT stats + DACHCS matches → data/stats.json
//  Run:   node scraper.js
//  Requires: FACEIT_API_KEY in .env or environment
//
//  v3 changes:
//   - DACHCS: Gruppe wird automatisch gefunden (Saison-übergreifend),
//     kein hardcodiertes group/260 mehr. Neues "Swiss"-Format wird geparst.
//   - FACEIT: Match-Historie über Spieler-History (v4 /players/{id}/history),
//     da /teams/{id}/history in der v4-API nicht existiert.
//   - Läuft auch ohne FACEIT_API_KEY (dann nur DACHCS-Update).
// ============================================================

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env ────────────────────────────────────────────────
const __dir     = dirname(fileURLToPath(import.meta.url));
const __envPath = join(__dir, '.env');
if (existsSync(__envPath)) {
  for (const line of readFileSync(__envPath, 'utf8').split('\n')) {
    const m = line.trim().match(/^([^#=\s][^=]*?)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const OUT_FILE = join(__dir, 'data', 'stats.json');
mkdirSync(join(__dir, 'data'), { recursive: true });

// ── Config ───────────────────────────────────────────────────
const FACEIT_API_KEY = process.env.FACEIT_API_KEY || '';
if (!FACEIT_API_KEY) {
  console.warn('⚠️  FACEIT_API_KEY not set — FACEIT-Daten werden übersprungen, nur DACHCS wird aktualisiert.');
}
const OPEN_API = 'https://open.faceit.com/data/v4';

const DACHCS_BASE = 'https://dachcs.de';
// Wie viele der neuesten Saisons nach der eigenen Gruppe durchsucht werden
const DACHCS_SEASONS_TO_SCAN = 4;

const TEAMS = {
  main: {
    slug:        'main',
    label:       'Donuts',
    faceitId:    '46c77ad9-8098-4c9c-a674-00a6a79a303e',
    dachcsTeam:  'DIEDONUTS',
    // Extra nicknames not registered on the FACEIT team (standins etc.)
    extra:       ['dolan-', 'Ibrakadabra', '_reda'],
  },
  nxt: {
    slug:        'nxt',
    label:       'Donuts Nxt',
    faceitId:    '5d25c833-2677-4c52-93e7-ce5699378a9a',
    dachcsTeam:  'DIEDONUTS NXT',
    extra:       ['chenko'],
  },
  dns: {
    slug:        'dns',
    label:       'Donuts DNS',
    faceitId:    '7de419f6-da07-46d0-819d-687874ffef17',
    dachcsTeam:  null,
    // Players who may not appear in FACEIT team API (yet)
    extra:       ['LilliFee1987', 'lAL3Xl'],
  },
};

// ── Helpers ──────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r2    = v  => Math.round(parseFloat(v || 0) * 100) / 100;

async function fetchFACEIT(endpoint) {
  if (!FACEIT_API_KEY) return null;
  try {
    const res = await fetch(`${OPEN_API}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${FACEIT_API_KEY}`,
        'Accept':        'application/json',
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`  ⚠ FACEIT ${res.status}: ${endpoint}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn(`  ⚠ fetchFACEIT error: ${e.message} — ${endpoint}`);
    return null;
  }
}

async function fetchHTML(url) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 DonutsBot/3.0' },
        signal:  AbortSignal.timeout(15000),
      });
      if (!res.ok) return '';
      return await res.text();
    } catch (e) {
      console.warn(`  ⚠ fetchHTML (Versuch ${attempt}): ${e.message} — ${url}`);
      await sleep(2000);
    }
  }
  return '';
}

async function postForm(url, params) {
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'User-Agent':   'Mozilla/5.0 DonutsBot/3.0',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    try { return JSON.parse(text); } catch { return null; }
  } catch (e) {
    console.warn(`  ⚠ postForm error: ${e.message} — ${url}`);
    return null;
  }
}

// ── FACEIT: Player by Nickname ────────────────────────────────
async function getPlayerByNickname(nickname) {
  const data = await fetchFACEIT(`/players?nickname=${encodeURIComponent(nickname)}&game=cs2`);
  if (!data) return null;
  const cs2 = data.games?.cs2 || {};
  return {
    faceitId:  data.player_id,
    nickname:  data.nickname,
    avatar:    data.avatar || '',
    country:   data.country || 'de',
    elo:       cs2.faceit_elo  || 0,
    level:     cs2.skill_level || 0,
    faceitUrl: `https://www.faceit.com/de/players/${data.nickname}`,
  };
}

// ── FACEIT: Player by GUID ────────────────────────────────────
async function getPlayerById(faceitId) {
  const data = await fetchFACEIT(`/players/${faceitId}`);
  if (!data) return null;
  const cs2 = data.games?.cs2 || {};
  return {
    faceitId:  data.player_id,
    nickname:  data.nickname,
    avatar:    data.avatar || '',
    country:   data.country || 'de',
    elo:       cs2.faceit_elo  || 0,
    level:     cs2.skill_level || 0,
    faceitUrl: `https://www.faceit.com/de/players/${data.nickname}`,
  };
}

// ── FACEIT: Lifetime Stats ────────────────────────────────────
async function getPlayerStats(faceitId) {
  const data = await fetchFACEIT(`/players/${faceitId}/stats/cs2`);
  if (!data?.lifetime) return null;
  const L = data.lifetime;

  const adrRaw = parseFloat(L['Average Damage per Round'] || 0);
  const krRaw  = parseFloat(L['Average K/R Ratio']        || 0);

  return {
    matches:  parseInt(L['Matches']              || 0),
    wins:     parseInt(L['Wins']                 || 0),
    winRate:  r2(L['Win Rate %']                 || 0),
    kd:       r2(L['Average K/D Ratio']          || 0),
    kr:       krRaw  > 0 ? r2(krRaw)             : null,
    adr:      adrRaw > 0 ? r2(adrRaw)            : null,
    hs:       r2(L['Average Headshots %']        || 0),
    avgKills: r2(L['Average Kills']              || 0),
  };
}

// ── FACEIT: Team Members ──────────────────────────────────────
async function getTeamMembers(teamFaceitId) {
  const data = await fetchFACEIT(`/teams/${teamFaceitId}`);
  if (!data?.members) return [];
  return data.members.map(m => ({
    faceitId: m.user_id,
    nickname: m.nickname,
    avatar:   m.avatar || '',
    country:  m.country || 'de',
  }));
}

// ── FACEIT: Team Map Stats ────────────────────────────────────
async function getTeamMapStats(teamFaceitId) {
  const data = await fetchFACEIT(`/teams/${teamFaceitId}/stats/cs2`);
  if (!data?.segments) return {};
  const maps = {};
  for (const seg of data.segments) {
    if (seg.type !== 'Map') continue;
    const s      = seg.stats || {};
    const played = parseInt(s['Matches'] || 0);
    const wins   = parseInt(s['Wins']    || 0);
    if (played === 0) continue;
    const key = (seg.label || 'unknown').toLowerCase().replace(/\s+/g, '_');
    maps[key] = {
      label:   seg.label,
      played,
      wins,
      winRate: Math.round((wins / played) * 100),
    };
  }
  return maps;
}

// ── FACEIT: Team-Matches über Spieler-History ─────────────────
// Die v4-API hat KEINEN /teams/{id}/history Endpoint. Stattdessen:
// History der Roster-Spieler holen und Matches behalten, in denen
// (a) eine Faction die Team-ID trägt, oder
// (b) mindestens 3 Roster-Spieler in derselben Faction standen.
async function getTeamMatchesViaPlayers(teamFaceitId, rosterIds, size = 10) {
  const rosterSet = new Set(rosterIds);
  const byId      = new Map();

  for (const pid of rosterIds.slice(0, 6)) {
    const data = await fetchFACEIT(`/players/${pid}/history?game=cs2&offset=0&limit=30`);
    await sleep(250);
    for (const item of (data?.items || [])) {
      if (byId.has(item.match_id)) continue;

      const factions = Object.entries(item.teams || {});
      if (factions.length !== 2) continue;

      let myKey = null;
      for (const [key, fac] of factions) {
        const facPlayers = (fac.players || []).map(p => p.player_id);
        const overlap    = facPlayers.filter(id => rosterSet.has(id)).length;
        if (fac.team_id === teamFaceitId || overlap >= 3) { myKey = key; break; }
      }
      if (!myKey) continue;

      const oppKey  = factions.find(([k]) => k !== myKey)[0];
      const myFac   = item.teams[myKey];
      const oppFac  = item.teams[oppKey];
      const status  = (item.status || '').toUpperCase();
      const finished = status === 'FINISHED';
      const myScore  = parseInt(item.results?.score?.[myKey]  ?? 0);
      const oppScore = parseInt(item.results?.score?.[oppKey] ?? 0);
      // Fallback über winner-Feld, falls score fehlt
      const winner   = item.results?.winner;

      let result;
      if (!finished)                result = status === 'CANCELLED' ? 'cancelled' : 'upcoming';
      else if (myScore !== oppScore) result = myScore > oppScore ? 'win' : 'loss';
      else if (winner)              result = winner === myKey ? 'win' : 'loss';
      else                          result = 'draw';

      byId.set(item.match_id, {
        matchId:     item.match_id,
        _ts:         item.finished_at || item.started_at || 0,
        _myKey:      myKey,
        _oppKey:     oppKey,
        date:        item.finished_at
          ? new Date(item.finished_at * 1000).toISOString().split('T')[0]
          : item.started_at
            ? new Date(item.started_at * 1000).toISOString().split('T')[0]
            : null,
        time:        item.started_at
          ? new Date(item.started_at * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
          : null,
        opponent:    oppFac?.nickname || oppFac?.name || 'Unknown',
        teamName:    myFac?.nickname  || myFac?.name  || null,
        competition: item.competition_name || null,
        result,
        score:       finished ? `${myScore}:${oppScore}` : null,
        status,
        faceitUrl:   item.faceit_url
          ? item.faceit_url.replace('{lang}', 'de')
          : `https://www.faceit.com/de/cs2/room/${item.match_id}`,
      });
    }
  }

  const matches = [...byId.values()]
    .filter(m => m.result === 'win' || m.result === 'loss' || m.result === 'draw')
    .sort((a, b) => b._ts - a._ts)
    .slice(0, size);

  // Liga-/Turnier-Matches (BO3 etc.): Die Spieler-History liefert dort nur
  // Runden einer Map. Über /matches/{id} holen wir best_of + echten Map-Score.
  for (const m of matches) {
    if (/queue|matchmaking/i.test(m.competition || '')) continue;
    const det = await fetchFACEIT(`/matches/${m.matchId}`);
    await sleep(250);
    if (!det) continue;

    const bo   = parseInt(det.best_of || 0) || null;
    const sc   = det.results?.score || {};
    const maps = Array.isArray(det.detailed_results) ? det.detailed_results : [];
    const myS  = sc[m._myKey], opS = sc[m._oppKey];

    if (bo && bo > 1 && myS != null && opS != null) {
      // Map-Score statt Runden einer einzelnen Map
      m.score  = `${myS}:${opS}`;
      m.result = parseInt(myS) > parseInt(opS) ? 'win'
               : parseInt(myS) < parseInt(opS) ? 'loss' : 'draw';
      m.format = `BO${bo}`;
      if (maps.length > 1) {
        m.mapScores = maps.map(r =>
          `${r.factions?.[m._myKey]?.score ?? '?'}:${r.factions?.[m._oppKey]?.score ?? '?'}`);
      }
    } else if (bo === 1 && maps.length === 1) {
      const f = maps[0].factions || {};
      const a = f[m._myKey]?.score, b = f[m._oppKey]?.score;
      if (a != null && b != null) m.score = `${a}:${b}`;
      m.format = 'BO1';
    }
  }

  return matches.map(({ _ts, _myKey, _oppKey, ...m }) => m);
}

// ── FACEIT: Upcoming matches via active championships ─────────
async function getTeamUpcomingMatches(teamFaceitId) {
  const upcoming = [];

  try {
    const tourData = await fetchFACEIT(`/teams/${teamFaceitId}/tournaments?offset=0&limit=10`);
    const tours = tourData?.items || [];
    if (!tours.length) {
      console.log('  No active tournaments found for team.');
      return [];
    }

    for (const tour of tours.slice(0, 5)) {
      const champId = tour.championship_id || tour.id;
      if (!champId) continue;

      const matchData = await fetchFACEIT(
        `/championships/${champId}/matches?type=upcoming&offset=0&limit=20`
      );
      await sleep(200);
      const matches = matchData?.items || [];

      for (const m of matches) {
        const teams    = m.teams || {};
        const teamKeys = Object.keys(teams);
        const involved = teamKeys.some(k => teams[k]?.team_id === teamFaceitId);
        if (!involved) continue;

        const isTeam1 = teams[teamKeys[0]]?.team_id === teamFaceitId;
        const oppTeam = teams[isTeam1 ? teamKeys[1] : teamKeys[0]] || {};
        const schedAt = m.scheduled_at;
        const dateObj = schedAt ? new Date(schedAt * 1000) : null;

        upcoming.push({
          matchId:     m.match_id,
          date:        dateObj ? dateObj.toISOString().split('T')[0] : null,
          time:        dateObj ? dateObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }) : null,
          opponent:    oppTeam.name || 'Unknown',
          competition: tour.name || m.competition_name || null,
          result:      'upcoming',
          score:       null,
          status:      m.status || 'SCHEDULED',
          faceitUrl:   `https://www.faceit.com/de/cs2/room/${m.match_id}`,
        });
      }
    }
  } catch (e) {
    console.warn(`  ⚠ getTeamUpcomingMatches: ${e.message}`);
  }

  const seen = new Set();
  return upcoming.filter(m => {
    if (seen.has(m.matchId)) return false;
    seen.add(m.matchId);
    return true;
  });
}

// ── DACHCS: HTML → Text ───────────────────────────────────────
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

// ── DACHCS: Gruppen automatisch finden ────────────────────────
// 1. /coverage/ → Saison-IDs (Dropdown, neueste zuerst)
// 2. AJAX: Saison → Spielklassen → Gruppen
// 3. Jede Gruppen-Seite laden und schauen, ob unser Team drinsteht
// Ergebnis wird global gecacht, damit pro Lauf jede Seite nur 1x geladen wird.
let _dachcsGroupsCache = null;

async function getAllDachcsGroups() {
  if (_dachcsGroupsCache) return _dachcsGroupsCache;
  const groups = [];

  const covHtml = await fetchHTML(`${DACHCS_BASE}/coverage/`);
  const saisons = [...covHtml.matchAll(/<option[^>]*data-saison='(\d+)'[^>]*>([^<]+)<\/option>/g)]
    .map(m => ({ id: m[1], title: m[2].trim() }));

  if (!saisons.length) {
    console.warn('  ⚠ DACHCS: Keine Saisons auf /coverage/ gefunden.');
    _dachcsGroupsCache = [];
    return [];
  }
  console.log(`  DACHCS Saisons gefunden: ${saisons.map(s => s.title).join(', ')}`);

  for (const saison of saisons.slice(0, DACHCS_SEASONS_TO_SCAN)) {
    const spielklassen = await postForm(
      `${DACHCS_BASE}/assets/php/ajax/change.saison.php`, { saison: saison.id }
    ) || [];
    await sleep(150);

    for (const sk of spielklassen) {
      const gruppen = await postForm(
        `${DACHCS_BASE}/assets/php/ajax/change.spielklasse.php`,
        { saison: saison.id, spielklasse: sk.id }
      ) || [];
      await sleep(150);

      for (const g of gruppen) {
        groups.push({
          groupId:     g.id,
          gruppe:      g.title,
          spielklasse: sk.title,
          saison:      saison.title,
          url:         `${DACHCS_BASE}/coverage/group/${g.id}`,
          html:        null, // lazy
        });
      }
    }
  }

  console.log(`  DACHCS: ${groups.length} Gruppen in den neuesten ${DACHCS_SEASONS_TO_SCAN} Saisons.`);
  _dachcsGroupsCache = groups;
  return groups;
}

// Exakter Team-Vergleich (verhindert, dass "DIEDONUTS" auch "DIEDONUTS NXT" matcht)
function isSameTeam(name, teamName) {
  return (name || '').trim().toUpperCase() === (teamName || '').trim().toUpperCase();
}

// Alle Gruppen-Seiten EINMAL laden und für alle Teams gleichzeitig prüfen.
// Ergebnis: Map teamName(UPPER) → [groupMeta, …]
let _teamGroupsCache = null;

async function discoverAllTeamGroups(teamNames) {
  if (_teamGroupsCache) return _teamGroupsCache;
  const result = new Map(teamNames.map(t => [t.toUpperCase(), []]));
  const groups = await getAllDachcsGroups();

  let scanned = 0;
  for (const g of groups) {
    g.html = await fetchHTML(g.url);
    await sleep(250);
    scanned++;
    if (scanned % 25 === 0) console.log(`  … ${scanned}/${groups.length} Gruppen gescannt`);
    if (!g.html) continue;

    const htmlUpper = g.html.toUpperCase();
    // Billiger Vorab-Check, erst dann exakte Bestätigung über die Tabelle
    const candidates = teamNames.filter(t => htmlUpper.includes(t.toUpperCase()));
    if (!candidates.length) { g.html = ''; continue; } // Speicher freigeben

    const standings = parseDACHCSStandings(g.html);
    for (const t of candidates) {
      if (standings.some(s => isSameTeam(s.team, t))) {
        console.log(`  ✔ ${t} gefunden in: ${g.saison} / Spielklasse ${g.spielklasse} / ${g.gruppe} (group/${g.groupId})`);
        result.get(t.toUpperCase()).push(g);
      }
    }
  }

  _teamGroupsCache = result;
  return result;
}

async function findTeamDachcsGroups(teamName, allTeamNames) {
  const map   = await discoverAllTeamGroups(allTeamNames);
  const found = map.get(teamName.toUpperCase()) || [];
  if (!found.length) console.log(`  DACHCS: ${teamName} in keiner aktuellen Gruppe gefunden.`);
  return found;
}

// ── DACHCS: Parse Matches ─────────────────────────────────────
// Unterstützt beide Formate:
//   alt: "10.05.2026 10.05. 19:00 TeamA - BO3 Spk 4 Gruppe D - TeamB Details"
//   neu: "03.07.2026 03.07. 23:00 TeamA - LIVE B Swiss - TeamB Details"
function parseDACHCSMatches(html, teamName, groupMeta) {
  const upcoming = [];
  const recent   = [];
  if (!html) return { upcoming, recent };

  const text      = stripHtml(html);
  const groupUrl  = groupMeta?.url || `${DACHCS_BASE}/coverage/`;
  const compName  = groupMeta ? `${groupMeta.saison}` : null;
  const divLabel  = groupMeta ? [groupMeta.spielklasse, groupMeta.gruppe].filter(Boolean).join(' ') : null;

  // Division-String wörtlich matchen (z.B. "B Swiss" oder "Cycle 3 Gruppe B").
  // Wichtig, weil Divisionsnamen Zahlen enthalten können und eine generische
  // Regex sonst Scores/Teamnamen falsch zuordnet.
  const escRe  = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const divPat = divLabel
    ? escRe(divLabel).replace(/\s+/g, '\\s+')
    : '.+?';

  // Twitch-Caster-Links aus dem rohen HTML ziehen
  // Cast-Links zeilenweise aus dem rohen HTML: Jede Match-Zeile beginnt mit
  // dem vollen Datum (DD.MM.YYYY); der Twitch-Link des Casts steht in der Zeile.
  const EXCLUDE_TWITCH = ['diedonuts_esports', 'videos', 'directory'];
  const rowCasters = [];
  {
    const dre  = /\d{2}\.\d{2}\.\d{4}/g;
    const idxs = [];
    let dm;
    while ((dm = dre.exec(html)) !== null) idxs.push(dm.index);
    for (let i = 0; i < idxs.length; i++) {
      const end = i + 1 < idxs.length ? idxs[i + 1] : Math.min(idxs[i] + 5000, html.length);
      const seg = html.slice(idxs[i], end);
      const tw  = seg.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
      rowCasters.push({
        date:   html.substr(idxs[i], 10),
        caster: tw && !EXCLUDE_TWITCH.includes(tw[1].toLowerCase()) ? tw[1] : null,
        seg,
      });
    }
  }
  const findCaster = (dateDE, teamStr) => {
    const row = rowCasters.find(r => r.date === dateDE && r.seg.includes(teamStr));
    return row ? row.caster : null;
  };

  // Upcoming: DATE SHORTDATE TIME Team1 - (BOx|LIVE) <Division...> - Team2 Details
  const upRe = new RegExp(
    '(\\d{2}\\.\\d{2}\\.\\d{4})\\s+\\d{2}\\.\\d{2}\\.\\s+(\\d{2}:\\d{2})\\s+(.+?)\\s+-\\s+(BO\\d|LIVE)\\s+' +
    divPat + '\\s+-\\s+(.+?)\\s+Details', 'g');
  let m;
  while ((m = upRe.exec(text)) !== null) {
    const [, date, time, team1, format, team2] = m;
    const t1 = team1.trim(), t2 = team2.trim();
    if (!isSameTeam(t1, teamName) && !isSameTeam(t2, teamName)) continue;

    // Caster: Twitch-Link aus der zugehörigen Match-Zeile
    const caster = findCaster(date, t2) || findCaster(date, t1);

    upcoming.push({
      date:      date.split('.').reverse().join('-'),
      time,
      team1:     t1,
      team2:     t2,
      format:    format === 'LIVE' ? 'BO3' : format,
      isLive:    format === 'LIVE',
      division:  divLabel,
      group:     null,
      competition: compName,
      isHome:    isSameTeam(t1, teamName),
      caster:    caster || null,
      dachcsUrl: groupUrl,
    });
  }

  // Recent: DATE SHORTDATE TIME Team1 SCORE (BOx) <Division...> SCORE Team2 Details
  const reRe = new RegExp(
    '(\\d{2}\\.\\d{2}\\.\\d{4})\\s+\\d{2}\\.\\d{2}\\.\\s+[\\d:]+\\s+(.+?)\\s+(\\d+)\\s+(BO\\d)\\s+' +
    divPat + '\\s+(\\d+)\\s+(.+?)\\s+Details', 'g');
  while ((m = reRe.exec(text)) !== null) {
    const [, date, team1, score1, format, score2, team2] = m;
    const t1 = team1.trim(), t2 = team2.trim();
    if (!isSameTeam(t1, teamName) && !isSameTeam(t2, teamName)) continue;
    const isTeam1     = isSameTeam(t1, teamName);
    const donutsScore = parseInt(isTeam1 ? score1 : score2);
    const oppScore    = parseInt(isTeam1 ? score2 : score1);
    recent.push({
      date:     date.split('.').reverse().join('-'),
      opponent: isTeam1 ? t2 : t1,
      result:   donutsScore > oppScore ? 'win' : donutsScore < oppScore ? 'loss' : 'draw',
      score:    `${donutsScore}:${oppScore}`,
      format,
      division: divLabel,
      group:    null,
      competition: compName,
      dachcsUrl: groupUrl,
    });
  }

  console.log(`  DACHCS [${groupMeta?.saison || '?'}]: ${upcoming.length} upcoming, ${recent.length} recent`);
  return { upcoming, recent };
}

// ── DACHCS: Standings ─────────────────────────────────────────
function parseDACHCSStandings(html) {
  const standings = [];
  if (!html) return standings;
  const text  = stripHtml(html);
  const block = text.match(/Points(.+?)(N[äa]chsten|Letzten)/s)?.[1] || text;
  const re    = /(\d+)\.\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(-?\d+)\s+(\d+)/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    standings.push({
      pos:    parseInt(m[1]),
      team:   m[2].trim(),
      played: parseInt(m[3]),
      wins:   parseInt(m[4]),
      losses: parseInt(m[5]),
      rd:     parseInt(m[6]),
      points: parseInt(m[7]),
    });
  }
  return standings;
}

// ── Fetch all players for a team (registered + extras) ────────
async function fetchTeamPlayers(cfg) {
  const players = [];
  const seen    = new Set();

  console.log('  Fetching FACEIT team members…');
  const members = await getTeamMembers(cfg.faceitId);
  await sleep(300);

  for (const member of members) {
    if (seen.has(member.faceitId)) continue;
    seen.add(member.faceitId);
    process.stdout.write(`  → ${member.nickname} … `);

    const profile = await getPlayerById(member.faceitId);
    await sleep(200);
    const stats   = await getPlayerStats(member.faceitId);
    await sleep(200);

    if (!profile) { console.log('skip (no profile)'); continue; }
    console.log(`ELO ${profile.elo} Lvl ${profile.level}`);
    players.push({ ...profile, stats: stats || {} });
  }

  if (cfg.extra?.length) {
    console.log(`  Fetching ${cfg.extra.length} extra player(s)…`);
    for (const nick of cfg.extra) {
      process.stdout.write(`  → ${nick} (extra) … `);
      const profile = await getPlayerByNickname(nick);
      await sleep(300);
      if (!profile) { console.log('not found'); continue; }
      if (seen.has(profile.faceitId)) { console.log('already in team'); continue; }
      seen.add(profile.faceitId);

      const stats = await getPlayerStats(profile.faceitId);
      await sleep(300);
      console.log(`ELO ${profile.elo} Lvl ${profile.level}`);
      players.push({ ...profile, stats: stats || {} });
    }
  }

  return players;
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log('🍩 DieDonuts Scraper v3 starting…\n');

  // Alte Daten laden, damit FACEIT-Daten bei einem Lauf ohne API-Key erhalten bleiben
  let previous = null;
  try { previous = JSON.parse(readFileSync(OUT_FILE, 'utf8')); } catch { /* first run */ }

  const output = {
    lastUpdated: new Date().toISOString(),
    teams: {},
    allPlayers: [],
  };

  for (const [key, cfg] of Object.entries(TEAMS)) {
    console.log(`\n── Team: ${cfg.label} ──────────────────────`);
    const prevTeam = previous?.teams?.[key] || {};

    // Players (FACEIT)
    let players = [];
    let mapStats = {};
    let faceitMatches = [];
    let faceitUpcoming = [];

    if (FACEIT_API_KEY) {
      players = await fetchTeamPlayers(cfg);

      console.log('  Fetching map stats…');
      mapStats = await getTeamMapStats(cfg.faceitId);
      await sleep(300);

      console.log('  Fetching match history (via player histories)…');
      const rosterIds = players.map(p => p.faceitId);
      faceitMatches = await getTeamMatchesViaPlayers(cfg.faceitId, rosterIds, 10);
      console.log(`  → ${faceitMatches.length} finished team match(es) found`);

      console.log('  Fetching upcoming FACEIT matches…');
      faceitUpcoming = await getTeamUpcomingMatches(cfg.faceitId);
      if (faceitUpcoming.length) {
        console.log(`  → ${faceitUpcoming.length} upcoming FACEIT match(es) found`);
        faceitUpcoming.forEach(m => console.log(`     ${m.date} ${m.time || ''} vs ${m.opponent} [${m.competition || 'FACEIT'}]`));
      }
      await sleep(300);
    } else {
      // Kein Key: alte FACEIT-Daten behalten
      players        = prevTeam.players        || [];
      mapStats       = prevTeam.mapStats       || {};
      faceitMatches  = prevTeam.faceitMatches  || [];
      faceitUpcoming = prevTeam.faceitUpcoming || [];
      console.log('  (FACEIT übersprungen — alte Daten übernommen)');
    }

    // DACHCS — Gruppe(n) automatisch finden
    let dachcsUpcoming = [], dachcsRecent = [], standings = [], dachcsUrl = null;
    if (cfg.dachcsTeam) {
      console.log('  Scraping DACHCS…');
      const allDachcsTeams = Object.values(TEAMS).map(t => t.dachcsTeam).filter(Boolean);
      const groups = await findTeamDachcsGroups(cfg.dachcsTeam, allDachcsTeams);
      for (const g of groups) {
        const parsed = parseDACHCSMatches(g.html, cfg.dachcsTeam, g);
        dachcsUpcoming.push(...parsed.upcoming);
        dachcsRecent.push(...parsed.recent);
        if (!standings.length) {
          standings = parseDACHCSStandings(g.html);
          dachcsUrl = g.url;
        }
      }
      // Sortieren: upcoming aufsteigend, recent absteigend
      dachcsUpcoming.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      dachcsRecent.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }

    output.teams[key] = {
      slug: cfg.slug,
      label: cfg.label,
      faceitId: cfg.faceitId,
      dachcsUrl,
      players,
      mapStats,
      faceitMatches,
      faceitUpcoming,
      dachcsUpcoming,
      dachcsRecent,
      standings,
    };

    for (const p of players) {
      if (p.elo > 0) output.allPlayers.push({ ...p, team: cfg.label, teamSlug: key });
    }
  }

  // Sort + deduplicate leaderboard
  output.allPlayers.sort((a, b) => b.elo - a.elo);
  const seen = new Set();
  output.allPlayers = output.allPlayers.filter(p => {
    if (seen.has(p.faceitId)) return false;
    seen.add(p.faceitId);
    return true;
  });

  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');

  console.log(`\n✅  Done!`);
  console.log(`   Teams:   ${Object.keys(output.teams).length}`);
  console.log(`   Players: ${output.allPlayers.length}`);
  console.log(`   Updated: ${output.lastUpdated}`);
}

main().catch(err => {
  console.error('❌  Scraper crashed:', err);
  process.exit(1);
});

// ============================================================
//  DieDonuts Esports — Live Stats Module  v2
//  Multi-proxy fallback · robust DACHCS parsing
// ============================================================

const FACEIT = 'https://api.faceit.com';

// ── Team config ──────────────────────────────────────────────
export const TEAMS = {
  main: {
    faceitId:    '46c77ad9-8098-4c9c-a674-00a6a79a303e',
    label:       'Donuts',
    dachcsGroup: 'https://dachcs.de/coverage/group/260',
    dachcsName:  'DIEDONUTS',
  },
  nxt: {
    faceitId:    '5d25c833-2677-4c52-93e7-ce5699378a9a',
    label:       'Donuts Nxt',
    dachcsGroup: null,
    dachcsName:  'DIEDONUTS NXT',
  },
  dns: {
    faceitId:    '7de419f6-da07-46d0-819d-687874ffef17',
    label:       'Donuts DNS',
    dachcsGroup: null,
    dachcsName:  null,
  },
};

// ── CORS proxy chain ─────────────────────────────────────────
// Each entry: { wrap(url) → proxied URL, extract(response) → text/object }
const PROXY_CHAIN = [
  {
    // corsproxy.io — returns raw response directly
    wrap: url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    json: async r => { const t = await r.text(); return JSON.parse(t); },
    text: async r => r.text(),
  },
  {
    // allorigins — wraps response in {contents:"..."}
    wrap: url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    json: async r => { const j = await r.json(); return JSON.parse(j.contents || 'null'); },
    text: async r => { const j = await r.json(); return j.contents || ''; },
  },
  {
    // codetabs — returns raw
    wrap: url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    json: async r => { const t = await r.text(); return JSON.parse(t); },
    text: async r => r.text(),
  },
];

// ── Fetch JSON (FACEIT API) ───────────────────────────────────
const FACEIT_HEADERS = {
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
};

async function apiFetch(url) {
  // Try direct first (works fine on GitHub Pages / most hosts)
  try {
    const r = await fetch(url, {
      headers: FACEIT_HEADERS,
      signal:  AbortSignal.timeout(6000),
    });
    if (r.ok) {
      const data = await r.json();
      console.debug('[stats] direct ok:', url);
      return data;
    }
  } catch { /* fall through to proxies */ }

  // Try each proxy in sequence (2 attempts per proxy for robustness)
  for (const proxy of PROXY_CHAIN) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(proxy.wrap(url), { signal: AbortSignal.timeout(12000) });
        if (!r.ok) break;
        const data = await proxy.json(r);
        if (data) {
          console.debug('[stats] proxy ok:', proxy.wrap(url).split('?')[0]);
          return data;
        }
      } catch { break; }
    }
  }

  console.warn('[stats] all fetches failed for:', url);
  return null;
}

// ── Fetch HTML (DACHCS pages) ─────────────────────────────────
async function htmlFetch(url) {
  for (const proxy of PROXY_CHAIN) {
    try {
      const r = await fetch(proxy.wrap(url), { signal: AbortSignal.timeout(12000) });
      if (!r.ok) continue;
      const html = await proxy.text(r);
      if (html && html.length > 500) {
        console.debug('[stats] htmlFetch ok, length:', html.length);
        return html;
      }
    } catch { continue; }
  }
  console.warn('[stats] htmlFetch failed for:', url);
  return '';
}

// ── HTML helpers ─────────────────────────────────────────────
function decodeHtml(html) {
  return html
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&auml;/g,  'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü')
    .replace(/&Auml;/g,  'Ä').replace(/&Ouml;/g, 'Ö').replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/g, 'ß');
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function r2(n) { return Math.round(parseFloat(n || 0) * 100) / 100; }

// ── Player: ELO + Level ──────────────────────────────────────
export async function fetchPlayerProfile(faceitId, nickname) {
  // Try GUID-based lookup first (only when we actually have a real ID)
  if (faceitId) {
    const d = await apiFetch(`${FACEIT}/users/v1/users/${faceitId}`);
    if (d?.payload) {
      const p   = d.payload;
      const cs2 = p.games?.cs2 || p.games?.csgo || {};
      if (cs2.faceit_elo) {
        return {
          faceitId,
          nickname: p.nickname,
          avatar:   p.avatar || '',
          country:  p.country || 'de',
          elo:      cs2.faceit_elo,
          level:    cs2.skill_level || 0,
        };
      }
    }
  }
  // Nickname lookup (works without auth token, also used as standin fallback)
  if (nickname) {
    const d2 = await apiFetch(`${FACEIT}/users/v1/nicknames/${encodeURIComponent(nickname)}`);
    if (d2?.payload) {
      const p   = d2.payload;
      const cs2 = p.games?.cs2 || p.games?.csgo || {};
      return {
        faceitId: p.id || faceitId,
        nickname: p.nickname,
        avatar:   p.avatar || '',
        country:  p.country || 'de',
        elo:      cs2.faceit_elo  || 0,
        level:    cs2.skill_level || 0,
      };
    }
  }
  return null;
}

// ── Player: Lifetime Stats ────────────────────────────────────
export async function fetchPlayerStats(faceitId) {
  const d = await apiFetch(`${FACEIT}/stats/v1/stats/users/${faceitId}/games/cs2`);
  if (!d?.lifetime) return null;
  const L = d.lifetime;
  return {
    matches:  parseInt(L.m1  || 0),
    wins:     parseInt(L.m2  || 0),
    winRate:  r2(L.k6),
    kd:       r2(L.c2),
    kr:       r2(L.c3),
    hs:       r2(L.c10),
    // c16 = ADR in FACEIT lifetime stats; null when not available (never fall back to HS%)
    adr:      (L.c16 != null && parseFloat(L.c16) > 0) ? r2(L.c16) : null,
    avgKills: r2(L.c5),
  };
}

// ── Team: Members ────────────────────────────────────────────
export async function fetchTeamMembers(teamFaceitId) {
  const d = await apiFetch(`${FACEIT}/teams/v1/teams/${teamFaceitId}`);
  if (!d?.payload?.members) return [];
  return d.payload.members.map(m => ({
    faceitId: m.guid,
    nickname: m.nickname,
    avatar:   m.avatar || '',
    country:  m.country || 'de',
  }));
}

// ── Team: Map Stats ──────────────────────────────────────────
export async function fetchTeamMapStats(teamFaceitId) {
  const d = await apiFetch(`${FACEIT}/stats/v1/stats/teams/${teamFaceitId}/games/cs2`);
  if (!d?.segments) return {};
  const seg = d.segments.find(
    s => s._id?.segmentId === 'csgo_map' && s._id?.gameMode === '5v5'
  );
  if (!seg?.segments) return {};
  const maps = {};
  for (const [map, v] of Object.entries(seg.segments)) {
    const played = parseInt(v.m1 || v.m35 || 0);
    const wins   = parseInt(v.m2 || 0);
    if (played < 3) continue;
    maps[map] = { played, wins, winRate: Math.round((wins / played) * 100) };
  }
  return maps;
}

// ── Team: Recent FACEIT Matches ──────────────────────────────
export async function fetchTeamMatches(teamFaceitId, size = 5) {
  const d = await apiFetch(
    `${FACEIT}/stats/v1/stats/time/teams/${teamFaceitId}/games/cs2?size=${size * 3}`
  );
  if (!Array.isArray(d)) return [];

  const byMatch = {};
  for (const m of d) {
    const mid = m.matchId;
    if (!byMatch[mid]) byMatch[mid] = {
      maps: [], date: m.date, matchId: mid, bestOf: m.bestOf || '1',
    };
    byMatch[mid].maps.push({
      map:        m.i1 || '?',
      score:      m.i18 || '?',
      won:        m.i2 === teamFaceitId,
      teamRounds: parseInt(m.i3 || 0),
      oppRounds:  parseInt(m.i4 || 0),
    });
  }

  return Object.values(byMatch)
    .sort((a, b) => b.date - a.date)
    .slice(0, size)
    .map(m => {
      const won  = m.maps.filter(x => x.won).length;
      const lost = m.maps.filter(x => !x.won).length;
      return {
        matchId:   m.matchId,
        date:      new Date(m.date * (m.date < 1e12 ? 1000 : 1)).toISOString().split('T')[0],
        bestOf:    m.bestOf,
        result:    won > lost ? 'win' : 'loss',
        mapScore:  `${won}:${lost}`,
        maps:      m.maps,
        faceitUrl: `https://www.faceit.com/de/cs2/room/${m.matchId}`,
      };
    });
}

// ── DACHCS: Parse stripped plain text ────────────────────────
export function parseDACHCSHtml(rawHtml, teamName) {
  const upcoming = [], recent = [], standings = [];
  if (!rawHtml) return { upcoming, recent, standings };

  // Decode HTML entities then strip all tags → clean plain text
  const text = stripTags(decodeHtml(rawHtml));
  console.debug('[stats] DACHCS text snippet:', text.slice(0, 300));

  // ── Upcoming matches ────────────────────────────────────────
  // Pattern in plain text:
  // "10.05.2026 10.05. 19:00 TeamA - BO3 Spk 4 Gruppe D - TeamB Details"
  // Date appears twice: full (DD.MM.YYYY) then short (DD.MM.) before the time
  const upRe = /(\d{2}\.\d{2}\.\d{4})\s+\d{2}\.\d{2}\.\s+(\d{2}:\d{2})\s+(.+?)\s+-\s+(BO\d|LIVE)\s+(Spk\s*\d+)\s+(Gruppe\s*\w+)\s+-\s+(.+?)\s+Details/g;
  let m;
  while ((m = upRe.exec(text)) !== null) {
    const [, rawDate, time, t1, fmt, spk, grp, t2] = m;
    const date = rawDate.split('.').reverse().join('-');
    upcoming.push({
      date,
      time,
      team1:     t1.trim(),
      team2:     t2.trim(),
      format:    fmt === 'LIVE' ? 'BO3' : fmt,
      isLive:    fmt === 'LIVE',
      division:  spk.trim(),
      group:     grp.trim(),
      isDonuts1: t1.trim().toUpperCase() === teamName.toUpperCase(),
    });
  }
  console.debug('[stats] DACHCS upcoming found:', upcoming.length);

  // ── Recent matches ──────────────────────────────────────────
  // "10.05.2026 10.05. HH:MM TeamA score1 BO3 Spk X Gruppe Y score2 TeamB Details"
  const reRe = /(\d{2}\.\d{2}\.\d{4})\s+\d{2}\.\d{2}\.\s+[\d:]+\s+(.+?)\s+(\d+)\s+(BO\d)\s+(Spk\s*\d+)\s+(Gruppe\s*\w+)\s+(\d+)\s+(.+?)\s+Details/g;
  while ((m = reRe.exec(text)) !== null) {
    const [, rawDate, t1, s1, fmt, spk, grp, s2, t2] = m;
    const isTeam1 = t1.trim().toUpperCase() === teamName.toUpperCase();
    const isTeam2 = t2.trim().toUpperCase() === teamName.toUpperCase();
    if (!isTeam1 && !isTeam2) continue;
    const ds = parseInt(isTeam1 ? s1 : s2);
    const os = parseInt(isTeam1 ? s2 : s1);
    recent.push({
      date:     rawDate.split('.').reverse().join('-'),
      opponent: (isTeam1 ? t2 : t1).trim(),
      result:   ds > os ? 'win' : 'loss',
      score:    `${ds}:${os}`,
      format:   fmt,
      division: spk.trim(),
      group:    grp.trim(),
    });
  }
  console.debug('[stats] DACHCS recent found:', recent.length);

  // ── Standings ───────────────────────────────────────────────
  const stRe = /(\d+)\.\s+([\wäöüÄÖÜß &.,_\-]+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(-?\d+)\s+(\d+)/g;
  while ((m = stRe.exec(text)) !== null) {
    const name = m[2].trim();
    if (name.length < 2) continue;
    standings.push({
      pos:    parseInt(m[1]), team: name,
      played: parseInt(m[3]), wins: parseInt(m[4]),
      losses: parseInt(m[5]), rd:   parseInt(m[6]), points: parseInt(m[7]),
      isDonuts: name.toUpperCase() === teamName.toUpperCase(),
    });
  }

  return { upcoming, recent, standings };
}

// ── DACHCS: Fetch + parse ─────────────────────────────────────
export async function fetchDACHCSMatches(groupUrl, teamName) {
  const html = await htmlFetch(groupUrl);
  return parseDACHCSHtml(html, teamName);
}

// ── Load from pre-built stats.json (same-origin, no CORS) ────
let _jsonCache = null;
async function loadStatsJson() {
  if (_jsonCache) return _jsonCache;
  try {
    const r = await fetch('/data/stats.json', { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return null;
    _jsonCache = await r.json();
    return _jsonCache;
  } catch { return null; }
}

// Convert scraper JSON format → loadTeamData format
function jsonToTeamData(teamKey, cfg, json) {
  const t = json?.teams?.[teamKey];
  if (!t || !t.players?.length) return null;
  return {
    ...cfg, teamKey,
    players:  t.players,
    mapStats: t.mapStats  || {},
    matches:  t.faceitMatches || [],
    dachcs: {
      upcoming:  t.dachcsUpcoming || [],
      recent:    t.dachcsRecent   || [],
      standings: t.standings      || [],
    },
  };
}

// ── All-in-one: full team data ────────────────────────────────
// Strategy: stats.json first (fast, no CORS) → live API fallback
export async function loadTeamData(teamKey) {
  const cfg = TEAMS[teamKey];
  if (!cfg) return null;

  // 1. Try pre-built JSON (works on localhost + GitHub Pages, no CORS)
  const json = await loadStatsJson();
  const fromJson = jsonToTeamData(teamKey, cfg, json);
  if (fromJson) {
    console.debug('[stats] using stats.json for', teamKey);
    // Fire live DACHCS fetch in background to get fresh upcoming matches
    if (cfg.dachcsGroup && cfg.dachcsName) {
      fetchDACHCSMatches(cfg.dachcsGroup, cfg.dachcsName)
        .then(dachcs => { fromJson.dachcs = dachcs; })
        .catch(() => {});
    }
    return fromJson;
  }

  // 2. Fallback: live FACEIT API (works on GitHub Pages, might fail on localhost)
  console.debug('[stats] stats.json empty/missing, trying live API for', teamKey);
  const [members, mapStats, matches] = await Promise.all([
    fetchTeamMembers(cfg.faceitId),
    fetchTeamMapStats(cfg.faceitId),
    fetchTeamMatches(cfg.faceitId, 5),
  ]);

  const players = await Promise.all(
    members.map(async mem => {
      const [profile, stats] = await Promise.all([
        fetchPlayerProfile(mem.faceitId, mem.nickname),
        fetchPlayerStats(mem.faceitId),
      ]);
      return profile ? { ...profile, stats: stats || {} } : null;
    })
  );

  let dachcs = { upcoming: [], recent: [], standings: [] };
  if (cfg.dachcsGroup && cfg.dachcsName) {
    dachcs = await fetchDACHCSMatches(cfg.dachcsGroup, cfg.dachcsName);
  }

  return { ...cfg, teamKey, players: players.filter(Boolean), mapStats, matches, dachcs };
}

// ── All players across all teams (for leaderboard / counter) ─
export async function loadAllPlayers() {
  const json = await loadStatsJson();
  if (json?.allPlayers?.length) {
    console.debug('[stats] allPlayers from stats.json:', json.allPlayers.length);
    return json.allPlayers;
  }
  // Fallback: fetch from all 3 teams live
  const results = await Promise.allSettled(
    Object.entries(TEAMS).map(async ([slug, cfg]) => {
      const members = await fetchTeamMembers(cfg.faceitId);
      return members.map(m => ({ ...m, team: cfg.label, teamSlug: slug }));
    })
  );
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

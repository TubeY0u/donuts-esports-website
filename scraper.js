#!/usr/bin/env node
// ============================================================
//  DieDonuts Esports — Data Scraper  v2
//  Fetches FACEIT stats + DACHCS matches → data/stats.json
//  Run:   node scraper.js
//  Requires: FACEIT_API_KEY in .env or environment
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
  console.error('❌  FACEIT_API_KEY not set — add it to .env');
  process.exit(1);
}
const OPEN_API = 'https://open.faceit.com/data/v4';

const TEAMS = {
  main: {
    slug:        'main',
    label:       'Donuts',
    faceitId:    '46c77ad9-8098-4c9c-a674-00a6a79a303e',
    dachcsGroup: 'https://dachcs.de/coverage/group/260',
    dachcsTeam:  'DIEDONUTS',
    // Extra nicknames not registered on the FACEIT team (standins etc.)
    extra:       ['dolan-', 'Ibrakadabra', '_reda'],
  },
  nxt: {
    slug:        'nxt',
    label:       'Donuts Nxt',
    faceitId:    '5d25c833-2677-4c52-93e7-ce5699378a9a',
    dachcsGroup: null,
    dachcsTeam:  null,
    extra:       ['chenko'],
  },
  dns: {
    slug:        'dns',
    label:       'Donuts DNS',
    faceitId:    '7de419f6-da07-46d0-819d-687874ffef17',
    dachcsGroup: null,
    dachcsTeam:  null,
    // Players who may not appear in FACEIT team API (yet)
    extra:       ['LilliFee1987', 'lAL3Xl'],
  },
};

// ── Helpers ──────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r2    = v  => Math.round(parseFloat(v || 0) * 100) / 100;

async function fetchFACEIT(endpoint) {
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
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 DonutsBot/2.0' },
    });
    if (!res.ok) return '';
    return await res.text();
  } catch (e) {
    console.warn(`  ⚠ fetchHTML error: ${e.message} — ${url}`);
    return '';
  }
}

// ── FACEIT: Player by Nickname ────────────────────────────────
async function getPlayerByNickname(nickname) {
  // GET /players?nickname={n}&game=cs2
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

  // The official v4 API uses human-readable keys in lifetime stats.
  // ADR is rarely populated in lifetime data — treat 0 as null.
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

// ── FACEIT: Match list helper ─────────────────────────────────
function parseMatchItem(match, teamFaceitId) {
  const teams    = match.teams || {};
  const teamKeys = Object.keys(teams);
  const isTeam1  = teams[teamKeys[0]]?.team_id === teamFaceitId;
  const myTeam   = teams[isTeam1 ? teamKeys[0] : teamKeys[1]] || {};
  const oppTeam  = teams[isTeam1 ? teamKeys[1] : teamKeys[0]] || {};
  const finished = match.status === 'FINISHED';
  const myScore  = parseInt(match.results?.score?.[myTeam.team_id]  || 0);
  const oppScore = parseInt(match.results?.score?.[oppTeam.team_id] || 0);

  // Determine competition label (ESEA, FACEIT league, etc.)
  const competition = match.competition_name || match.championship_name || null;

  return {
    matchId:     match.match_id,
    date:        match.finished_at
      ? new Date(match.finished_at * 1000).toISOString().split('T')[0]
      : match.scheduled_at
        ? new Date(match.scheduled_at * 1000).toISOString().split('T')[0]
        : null,
    time:        match.scheduled_at
      ? new Date(match.scheduled_at * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
      : null,
    opponent:    oppTeam.name || 'Unknown',
    competition,
    result:      !finished ? (match.status === 'CANCELLED' ? 'cancelled' : 'upcoming')
                 : myScore > oppScore  ? 'win'
                 : myScore < oppScore  ? 'loss'
                 : 'draw',
    score:       finished ? `${myScore}:${oppScore}` : null,
    status:      match.status,
    faceitUrl:   `https://www.faceit.com/de/cs2/room/${match.match_id}`,
  };
}

// ── FACEIT: Recent finished matches ──────────────────────────
async function getTeamMatches(teamFaceitId, size = 10) {
  const data = await fetchFACEIT(
    `/teams/${teamFaceitId}/history?game=cs2&offset=0&limit=${size}`
  );
  if (!data?.items) return [];
  return data.items
    .map(m => parseMatchItem(m, teamFaceitId))
    .filter(m => m.result !== 'upcoming'); // history = only finished
}

// ── FACEIT: Upcoming matches via active championships ─────────
// Official v4 API: get team's tournaments → find active ones → get upcoming matches
async function getTeamUpcomingMatches(teamFaceitId) {
  const upcoming = [];

  try {
    // 1. Get tournaments the team is in
    const tourData = await fetchFACEIT(`/teams/${teamFaceitId}/tournaments?offset=0&limit=10`);
    const tours = tourData?.items || [];
    if (!tours.length) {
      console.log('  No active tournaments found for team.');
      return [];
    }

    for (const tour of tours.slice(0, 5)) {
      const champId = tour.championship_id || tour.id;
      if (!champId) continue;

      // 2. Get upcoming matches for this championship
      const matchData = await fetchFACEIT(
        `/championships/${champId}/matches?type=upcoming&offset=0&limit=20`
      );
      await sleep(200);
      const matches = matchData?.items || [];

      for (const m of matches) {
        // Only include matches where our team is involved
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

  // Deduplicate by matchId
  const seen = new Set();
  return upcoming.filter(m => {
    if (seen.has(m.matchId)) return false;
    seen.add(m.matchId);
    return true;
  });
}

// ── DACHCS: Parse Matches ─────────────────────────────────────
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function parseDACHCSMatches(html, teamName) {
  const upcoming = [];
  const recent   = [];
  if (!html) return { upcoming, recent };

  const text      = stripHtml(html);
  const teamLower = teamName.toLowerCase();

  // Upcoming: DD.MM.YYYY DD.MM. HH:MM TeamA - BO3 Spk N Gruppe X - TeamB Details [Cast: twitchnick]
  const upRe = /(\d{2}\.\d{2}\.\d{4})\s+\d{2}\.\d{2}\.\s+(\d{2}:\d{2})\s+(.+?)\s+-\s+(BO\d|LIVE)\s+Spk\s+(\d+)\s+Gruppe\s+(\w+)\s+-\s+(.+?)\s+Details/g;
  let m;

  // Extract all Twitch links/caster names from the raw HTML (before stripping)
  // DACHCS embeds them as: twitch.tv/channelname or in anchor hrefs
  const twitchLinksInHtml = [];
  const twitchHrefRe = /twitch\.tv\/([a-zA-Z0-9_]+)/g;
  let twitchM;
  while ((twitchM = twitchHrefRe.exec(html)) !== null) {
    const nick = twitchM[1].toLowerCase();
    // Exclude generic/org channels that aren't match casts
    if (!['diedonuts_esports', 'videos', 'directory'].includes(nick)) {
      twitchLinksInHtml.push(nick);
    }
  }

  while ((m = upRe.exec(text)) !== null) {
    const [, date, time, team1, format, spkNum, gruppe, team2] = m;
    const t1 = team1.trim(), t2 = team2.trim();
    if (!t1.toLowerCase().includes(teamLower) && !t2.toLowerCase().includes(teamLower)) continue;

    // Try to find a caster for this match:
    // Look for "Cast" keyword near this match in the text
    const matchEnd = m.index + m[0].length;
    const snippet  = text.slice(matchEnd, matchEnd + 200);
    let caster = null;
    const castTextRe = /Cast[:\s]+(?:twitch\.tv\/)?([a-zA-Z0-9_]+)/i;
    const castMatch  = snippet.match(castTextRe);
    if (castMatch) {
      caster = castMatch[1];
    } else if (twitchLinksInHtml.length) {
      // Fallback: if there's only one unique Twitch link in the whole page, it's likely the caster
      const unique = [...new Set(twitchLinksInHtml)];
      if (unique.length === 1) caster = unique[0];
    }

    upcoming.push({
      date:      date.split('.').reverse().join('-'),
      time,
      team1:     t1,
      team2:     t2,
      format:    format === 'LIVE' ? 'BO3' : format,
      isLive:    format === 'LIVE',
      division:  `Spk ${spkNum}`,
      group:     `Gruppe ${gruppe}`,
      isHome:    t1.toLowerCase().includes(teamLower),
      caster:    caster || null,
      dachcsUrl: 'https://dachcs.de/coverage/group/260',
    });
  }

  // Recent: DD.MM.YYYY DD.MM. HH:MM TeamA SCORE BO3 Spk N Gruppe X SCORE TeamB Details
  const reRe = /(\d{2}\.\d{2}\.\d{4})\s+\d{2}\.\d{2}\.\s+[\d:]+\s+(.+?)\s+(\d+)\s+(BO\d)\s+Spk\s+(\d+)\s+Gruppe\s+(\w+)\s+(\d+)\s+(.+?)\s+Details/g;
  while ((m = reRe.exec(text)) !== null) {
    const [, date, team1, score1, format, spkNum, gruppe, score2, team2] = m;
    const t1 = team1.trim(), t2 = team2.trim();
    if (!t1.toLowerCase().includes(teamLower) && !t2.toLowerCase().includes(teamLower)) continue;
    const isTeam1     = t1.toLowerCase().includes(teamLower);
    const donutsScore = parseInt(isTeam1 ? score1 : score2);
    const oppScore    = parseInt(isTeam1 ? score2 : score1);
    recent.push({
      date:     date.split('.').reverse().join('-'),
      opponent: isTeam1 ? t2 : t1,
      result:   donutsScore > oppScore ? 'win' : donutsScore < oppScore ? 'loss' : 'draw',
      score:    `${donutsScore}:${oppScore}`,
      format,
      division: `Spk ${spkNum}`,
      group:    `Gruppe ${gruppe}`,
      dachcsUrl: 'https://dachcs.de/coverage/group/260',
    });
  }

  console.log(`  DACHCS: ${upcoming.length} upcoming, ${recent.length} recent`);
  return { upcoming, recent };
}

// ── DACHCS: Standings ─────────────────────────────────────────
function parseDACHCSStandings(html) {
  const standings = [];
  if (!html) return standings;
  const text  = stripHtml(html);
  const block = text.match(/Points(.+?)N[äa]chsten/s)?.[1] || text;
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
  const seen    = new Set(); // deduplicate by faceitId

  // 1. Team members registered on FACEIT team
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

  // 2. Extra players (standins / not on FACEIT team yet)
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
  console.log('🍩 DieDonuts Scraper v2 starting…\n');

  const output = {
    lastUpdated: new Date().toISOString(),
    teams: {},
    allPlayers: [],
  };

  for (const [key, cfg] of Object.entries(TEAMS)) {
    console.log(`\n── Team: ${cfg.label} ──────────────────────`);

    // Players
    const players = await fetchTeamPlayers(cfg);

    // Map stats
    console.log('  Fetching map stats…');
    const mapStats = await getTeamMapStats(cfg.faceitId);
    await sleep(300);

    // Match history (FACEIT — finished)
    console.log('  Fetching match history…');
    const faceitMatches = await getTeamMatches(cfg.faceitId, 10);
    await sleep(300);

    // Upcoming FACEIT/ESEA matches (scheduled)
    console.log('  Fetching upcoming FACEIT matches…');
    const faceitUpcoming = await getTeamUpcomingMatches(cfg.faceitId);
    if (faceitUpcoming.length) {
      console.log(`  → ${faceitUpcoming.length} upcoming FACEIT match(es) found`);
      faceitUpcoming.forEach(m => console.log(`     ${m.date} ${m.time || ''} vs ${m.opponent} [${m.competition || 'FACEIT'}]`));
    }
    await sleep(300);

    // DACHCS
    let dachcsUpcoming = [], dachcsRecent = [], standings = [];
    if (cfg.dachcsGroup && cfg.dachcsTeam) {
      console.log('  Scraping DACHCS…');
      const html = await fetchHTML(cfg.dachcsGroup);
      const parsed   = parseDACHCSMatches(html, cfg.dachcsTeam);
      dachcsUpcoming = parsed.upcoming;
      dachcsRecent   = parsed.recent;
      standings      = parseDACHCSStandings(html);
      await sleep(500);
    }

    output.teams[key] = {
      slug: cfg.slug,
      label: cfg.label,
      faceitId: cfg.faceitId,
      players,
      mapStats,
      faceitMatches,
      faceitUpcoming,
      dachcsUpcoming,
      dachcsRecent,
      standings,
    };

    // Collect for global leaderboard
    for (const p of players) {
      if (p.elo > 0) output.allPlayers.push({ ...p, team: cfg.label, teamSlug: key });
    }
  }

  // Sort + deduplicate leaderboard (highest ELO wins when player appears in multiple teams)
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
  console.log(`   File:    ${OUT_FILE}`);
}

main().catch(err => {
  console.error('❌  Scraper crashed:', err);
  process.exit(1);
});

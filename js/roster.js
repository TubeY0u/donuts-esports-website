
// ============================================================
//  DieDonuts Esports — Live FACEIT Stats Loader
//  Runs on page load, fetches fresh data, patches the DOM.
// ============================================================
import { loadTeamData, fetchPlayerProfile, fetchPlayerStats, loadAllPlayers, loadStatsJson } from '/js/stats.js';

// ── Helpers ──────────────────────────────────────────────────
function lvlClass(l) {
  if (l >= 10) return 'lvl-10';
  if (l >= 9)  return 'lvl-9';
  if (l >= 8)  return 'lvl-8';
  if (l >= 7)  return 'lvl-7';
  if (l >= 6)  return 'lvl-6';
  if (l >= 5)  return 'lvl-5';
  if (l >= 4)  return 'lvl-4';
  if (l >= 3)  return 'lvl-3';
  return 'lvl-1';
}

function fmtNum(n) {
  if (n == null || n === 0) return '—';
  return Number(n).toLocaleString('de-DE');
}

// ── Patch one player card ─────────────────────────────────────
function patchCard(article, p) {
  if (!p || !article) return;
  const { elo, level, stats, nickname, faceitId } = p;

  // Front — ELO value
  const eloVal = article.querySelector('.player-elo .v');
  if (eloVal && elo > 0) {
    eloVal.textContent = elo.toLocaleString('de-DE');
    eloVal.removeAttribute('style');
  }

  // Front — level badge
  const lvlWrap = article.querySelector('.player-level');
  if (lvlWrap && level > 0) {
    lvlWrap.innerHTML = `<span class="lvl-dot ${lvlClass(level)}"></span>LVL ${level}`;
  }

  // Back — stat cells
  if (stats) {
    const statMap = {
      'K/D':      (stats.kd      != null && stats.kd      > 0) ? stats.kd             : null,
      'K/R':      (stats.kr      != null && stats.kr      > 0) ? stats.kr             : null,
      'ADR':      (stats.adr     != null && stats.adr     > 0) ? stats.adr            : null,
      'HS%':      (stats.hs      != null && stats.hs      > 0) ? stats.hs + '%'       : null,
      'Win Rate': (stats.winRate != null && stats.winRate > 0) ? stats.winRate + '%'  : null,
      'Matches':  (stats.matches != null && stats.matches > 0) ? fmtNum(stats.matches): null,
    };
    article.querySelectorAll('.stats-grid .stat').forEach(cell => {
      const label = cell.querySelector('.l')?.textContent?.trim();
      const valEl = cell.querySelector('.v');
      if (label && valEl && statMap[label] != null) {
        valEl.textContent = statMap[label];
        valEl.removeAttribute('style');
      }
    });

    // Footer avg kills
    const foot = article.querySelector('.player-back-foot span');
    if (foot && stats.avgKills > 0) foot.textContent = `${stats.avgKills} Avg Kills`;
  }

  // FACEIT link on back
  if (faceitId || nickname) {
    const link = article.querySelector('.player-back-foot a');
    if (link && nickname) link.href = `https://www.faceit.com/de/players/${encodeURIComponent(nickname)}`;
  }
}

// ── Render map stats bar section ─────────────────────────────
function renderMapStats(el, mapStats) {
  if (!el) return;
  const entries = Object.entries(mapStats || {})
    .filter(([, v]) => v.played >= 3)
    .sort((a, b) => b[1].winRate - a[1].winRate);
  const totalW = entries.reduce((s, [,v]) => s + v.wins, 0);
  const totalP = entries.reduce((s, [,v]) => s + v.played, 0);
  // Ohne belastbare Datenmenge lieber gar nichts zeigen als eine einzelne Map
  if (!entries.length || totalP < 10) { el.style.display = 'none'; return; }
  el.style.display = '';

  const totalL = totalP - totalW;

  el.innerHTML = `
    <div class="map-stats-header">
      <span class="map-stats-title">/ Map Performance · 5v5</span>
      <span class="map-record-badge"><strong>${totalW}W</strong> / ${totalL}L · ${totalP} Matches gesamt</span>
    </div>
    <div class="map-bars">
      ${entries.map(([map, v]) => {
        const name = map.replace(/^de_/, '').replace(/^\w/, c => c.toUpperCase());
        const cls  = v.winRate >= 55 ? ' hot' : v.winRate <= 40 ? ' cold' : '';
        return `<div class="map-bar-row">
          <span class="map-bar-name">${name}</span>
          <div class="map-bar-track"><div class="map-bar-fill${cls}" data-pct="${v.winRate}"></div></div>
          <span class="map-bar-pct">${v.winRate}%</span>
        </div>`;
      }).join('')}
    </div>`;

  // Animate bars after paint (CSS uses transform: scaleX)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.querySelectorAll('.map-bar-fill[data-pct]').forEach(b => {
      b.style.transform = `scaleX(${parseInt(b.dataset.pct) / 100})`;
    });
  }));
}

// ── Update team quick-stats strip ────────────────────────────
function patchTeamQuick(blockId, players) {
  const block = document.getElementById(blockId);
  if (!block) return;
  // Only count players whose card actually lives in THIS team's block
  const active = players.filter(p => {
    const card = block.querySelector(`[data-nickname="${p.nickname}"]`);
    return p.elo > 0 && card && !card.classList.contains('player--standin');
  });
  if (!active.length) return;
  const topElo = Math.max(...active.map(p => p.elo));
  const avgElo = Math.round(active.reduce((s, p) => s + p.elo, 0) / active.length);
  const vals = block.querySelectorAll('.team-quick .v');
  if (vals[0]) vals[0].textContent = active.length;
  if (vals[1]) vals[1].textContent = topElo.toLocaleString('de-DE');
  if (vals[2]) vals[2].textContent = avgElo.toLocaleString('de-DE');
}

// ── Rebuild ELO leaderboard ───────────────────────────────────
function renderLeaderboard(allPlayers) {
  const list = document.getElementById('elo-lb-list');
  if (!list) return;

  // Live timestamp
  const sub = document.getElementById('eloLbSub');
  if (sub) {
    const d = new Date();
    sub.textContent = `FACEIT · Live · ${d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`;
  }

  const TEAM_LABELS = { main: 'Donuts', nxt: 'Nxt', dns: 'DNS' };

  // Deduplicate: each player once (highest ELO / first team = main > nxt > dns)
  const seen = new Set();
  const unique = allPlayers
    .filter(p => p.nickname.toLowerCase() !== 'xelfer')
    .filter(p => {
      const key = p.nickname.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.elo - a.elo);

  const topElo = unique[0]?.elo || 1;
  const rows = [];
  let rank = 0;

  for (const p of unique) {
    rank++;
    const teamLabel = TEAM_LABELS[p.teamSlug] || p.teamSlug;
    const isMain    = p.teamSlug === 'main';
    const pct       = Math.round((p.elo / topElo) * 100);
    const lbCls     = p.level >= 10 ? 'is-10' : p.level >= 9 ? 'is-9' : p.level >= 8 ? 'is-8' : p.level >= 7 ? 'is-7' : p.level >= 6 ? 'is-6' : p.level >= 5 ? 'is-5' : p.level >= 4 ? 'is-4' : p.level >= 3 ? 'is-3' : p.level >= 2 ? 'is-2' : 'is-1';
    rows.push({ ...p, rank, teamLabel, isMain, pct, lbCls });
  }

  list.innerHTML = rows.map(row => {
    return `<div class="elo-lb-row${row.level >= 10 ? ' lvl10' : ''}${row.teamSlug === 'dns' ? ' dns-row' : ''}">
      <span class="elo-lb-rank">#${row.rank}</span>
      <span class="elo-lb-name"><a href="https://www.faceit.com/de/players/${encodeURIComponent(row.nickname)}" target="_blank" rel="noopener">${row.nickname}</a></span>
      <span class="elo-lb-team ${row.teamSlug}">${row.teamLabel}</span>
      <div class="elo-lb-bar-wrap"><div class="elo-lb-bar" data-pct="${row.pct}"></div></div>
      <span class="elo-lb-elo">${row.elo.toLocaleString('de-DE')}</span>
      <span class="elo-lb-lvl${row.lbCls ? ' ' + row.lbCls : ''}">LVL ${row.level}</span>
    </div>`;
  }).join('');

  // Animate bars
  requestAnimationFrame(() => requestAnimationFrame(() => {
    list.querySelectorAll('.elo-lb-bar:not(.elo-lb-bar--hidden)[data-pct]').forEach(b => {
      b.style.transform = `scaleX(${parseInt(b.dataset.pct) / 100})`;
    });
  }));

  // Populate preview strip with real top-3
  const preview = document.getElementById('eloLbPreview');
  const moreEl  = document.getElementById('eloLbMore');
  if (preview) {
    const realRows = rows.slice(0, 3);
    preview.querySelectorAll('.elp-item').forEach((el, i) => {
      const r = realRows[i];
      if (!r) return;
      el.querySelector('.elp-rank').textContent = `#${r.rank}`;
      el.querySelector('.elp-name').textContent = r.nickname;
      el.querySelector('.elp-elo').textContent  = r.elo.toLocaleString('de-DE');
    });
    if (moreEl) {
      const rest = unique.length - 3;
      moreEl.textContent = rest > 0 ? `+${rest} weitere` : '';
    }
  }

}

// Toggle setup — runs immediately, independent of async data load
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('eloToggle');
  const list = document.getElementById('elo-lb-list');
  if (btn && list) {
    btn.addEventListener('click', () => {
      const collapsed = list.classList.toggle('is-collapsed');
      btn.classList.toggle('is-collapsed', collapsed);
      btn.setAttribute('aria-expanded', String(!collapsed));
      btn.querySelector('.toggle-label').textContent = collapsed ? 'Ausklappen' : 'Einklappen';
    });
  }
});

// ── Helpers für die neuen Seiten ─────────────────────────────
const setText = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.textContent = v; };
const escH = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const ownStanding = (t) => (t && t.standings || []).find(r => /DIEDONUTS/i.test(r.team || ''));
const TEAM_META = {
  main: { label: 'Donuts',     href: '/roster/main/', logo: '/assets/logo_trans.png' },
  nxt:  { label: 'Donuts Nxt', href: '/roster/nxt/',  logo: '/assets/Logo_NXT.png'  },
  dns:  { label: 'Donuts DNS', href: '/roster/dns/',  logo: '/assets/Logo_DNS.png'  },
};

const cleanOpp = (v) => String(v || '?').replace(/^team[_-]/i, '');

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00');
  return isNaN(dt) ? d : dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ── Team-Übersicht (/roster/) ────────────────────────────────
async function renderTeamCards() {
  const wrap = document.getElementById('teamCards');
  if (!wrap) return;
  const json = await loadStatsJson();

  wrap.querySelectorAll('.tc-card').forEach(card => {
    const slug = card.dataset.team;
    const t = json && json.teams ? json.teams[slug] : null;
    if (!t) return;

    const all = (t.players || []).filter(p => p.elo > 0);

    // Startaufstellung steht als data-lineup auf der Karte (aus der Team-Seite
    // generiert). Nur die zaehlen hier, Standins bleiben aussen vor.
    let lineup = [];
    try { lineup = JSON.parse(card.dataset.lineup || '[]'); } catch (e) { lineup = []; }

    const byNick = new Map(all.map(p => [p.nickname.toLowerCase(), p]));
    const shown = lineup.length
      ? lineup.slice(0, 5).map(l => ({ ...l, data: byNick.get(String(l.n).toLowerCase()) }))
      : all.slice(0, 5).map(p => ({ n: p.nickname, p: '', i: p.nickname.slice(0, 2).toUpperCase(), data: p }));

    const elos = shown.map(x => x.data && x.data.elo).filter(v => v > 0);
    const top  = elos.length ? Math.max(...elos) : 0;
    const avg  = elos.length ? Math.round(elos.reduce((a, b) => a + b, 0) / elos.length) : 0;
    const set = (sel, v) => { const e = card.querySelector(sel); if (e && v != null) e.textContent = v; };

    // Spielerzahl waere auf jeder Karte 5 und damit nutzlos — stattdessen der
    // Schnitt ueber die Startaufstellung, wie auf den Team-Seiten.
    set('[data-slot="avg"]', avg ? avg.toLocaleString('de-DE') : '—');
    set('[data-slot="top"]', top ? top.toLocaleString('de-DE') : '—');

    const row = ownStanding(t);
    const recent0 = (t.dachcsRecent || [])[0] || {};
    if (row) {
      set('[data-slot="statusLabel"]', recent0.competition || 'Liga');
      set('[data-slot="status"]', `${row.pos}. · ${row.wins}W/${row.losses}L`);
    } else {
      set('[data-slot="statusLabel"]', 'Aktuell');
      set('[data-slot="status"]', 'Keine Liga-Runde');
    }

    // Gesichter der Startaufstellung, echte Bildpfade aus der Team-Seite
    const faces = card.querySelector('[data-slot="faces"]');
    if (faces) {
      faces.innerHTML = shown.map(x => {
        const nick = escH(x.n);
        const ini  = escH(x.i || String(x.n).slice(0, 2).toUpperCase());
        const img  = x.p ? `<img src="${escH(x.p)}" alt="" loading="lazy" onerror="this.remove()">` : '';
        return `<span class="tc-face" title="${nick}"><span>${ini}</span>${img}</span>`;
      }).join('');
    }
  });
}

// ── Einzelne Team-Seite (/roster/main/ usw.) ─────────────────
async function renderTeamPage() {
  const root = document.querySelector('[data-team]');
  if (!root) return;
  const slug = root.dataset.team;
  const json = await loadStatsJson();
  const t = json && json.teams ? json.teams[slug] : null;
  if (!t) return;

  const row = ownStanding(t);
  const recent0 = (t.dachcsRecent || [])[0] || {};

  setText('tpComp',   recent0.competition || 'Keine Liga-Runde');
  setText('tpDiv',    recent0.division || '—');
  setText('tpPos',    row ? `${row.pos}.` : '—');
  setText('tpRecord', row ? `${row.wins}W / ${row.losses}L` : '—');
  setText('tpRd',     row ? `${row.rd > 0 ? '+' : ''}${row.rd}` : '—');

  // Tabelle
  const tbl = document.getElementById('tpStandings');
  if (tbl) {
    const rows = t.standings || [];
    if (!rows.length) {
      tbl.innerHTML = '<p class="tp-empty">Für dieses Roster läuft gerade keine Liga-Runde. Ergebnisse aus FACEIT stehen rechts.</p>';
    } else {
      tbl.innerHTML = `<table class="tp-table"><thead><tr>
          <th>#</th><th>Team</th><th>Sp</th><th>S</th><th>N</th><th>RD</th><th>Pkt</th>
        </tr></thead><tbody>` +
        rows.map(r => {
          const us = /DIEDONUTS/i.test(r.team || '');
          return `<tr class="${us ? 'is-us' : ''}">
            <td>${r.pos}</td><td>${escH(r.team)}</td><td>${r.played}</td>
            <td>${r.wins}</td><td>${r.losses}</td>
            <td>${r.rd > 0 ? '+' : ''}${r.rd}</td><td>${r.points}</td></tr>`;
        }).join('') + '</tbody></table>';
    }
  }

  // Letzte Matches — Liga bevorzugt, sonst FACEIT
  const rec = document.getElementById('tpRecent');
  if (rec) {
    const league = (t.dachcsRecent || []).map(m => ({
      date: m.date, opponent: m.opponent, result: m.result, score: m.score,
      tag: m.competition || 'DACHCS', url: m.dachcsUrl || '',
    }));
    const pugs = (t.faceitMatches || []).map(m => ({
      date: m.date, opponent: cleanOpp(m.opponent), result: m.result, score: m.score,
      tag: m.competition || 'FACEIT', url: m.faceitUrl || '',
    }));
    const list = (league.length ? league : pugs).slice(0, 6);

    if (!list.length) {
      rec.innerHTML = '<p class="tp-empty">Noch keine Ergebnisse erfasst.</p>';
    } else {
      if (!league.length) {
        const note = document.getElementById('tpRecentNote');
        if (note) note.textContent = 'FACEIT · zuletzt gespielt';
      }
      rec.innerHTML = list.map(m => `
        <div class="tp-match ${m.result === 'win' ? 'is-win' : 'is-loss'}">
          <span class="tp-match-res">${m.result === 'win' ? 'W' : 'L'}</span>
          <span class="tp-match-opp">${escH(m.opponent || '?')}</span>
          <span class="tp-match-score">${escH(m.score || '')}</span>
          <span class="tp-match-date">${fmtDate(m.date)}</span>
          ${m.url ? `<a class="tp-match-link" href="${escH(m.url)}" target="_blank" rel="noopener" aria-label="Match öffnen">→</a>` : '<span></span>'}
        </div>`).join('');
    }
  }
}

// ── Boot ─────────────────────────────────────────────────────
const ALL_TEAM_BLOCKS = [
  { teamSlug: 'main', blockId: 'donuts', mapId: 'map-stats-main' },
  { teamSlug: 'nxt',  blockId: 'nxt',    mapId: 'map-stats-nxt'  },
  { teamSlug: 'dns',  blockId: 'team3',  mapId: 'map-stats-dns'  },
];
// Nur die Blöcke laden, die auf DIESER Seite auch existieren.
const TEAM_BLOCKS = ALL_TEAM_BLOCKS.filter(b => document.getElementById(b.blockId));

async function init() {
  renderTeamCards();
  renderTeamPage();

  const allPlayers = [];

  if (TEAM_BLOCKS.length) {
    // ── Phase 1: stats.json → sonst live FACEIT-API über Proxy ──
    const datas = await Promise.all(
      TEAM_BLOCKS.map(b => loadTeamData(b.teamSlug).catch(() => null))
    );

    datas.forEach((data, idx) => {
      if (!data) return;
      const { teamSlug, blockId, mapId } = TEAM_BLOCKS[idx];
      const blockEl = document.getElementById(blockId);
      data.players.forEach(p => {
        const art = blockEl
          ? blockEl.querySelector(`[data-nickname="${p.nickname}"]`)
          : document.querySelector(`[data-nickname="${p.nickname}"]`);
        if (!art) return; // Karte gehört zu einem anderen Roster
        patchCard(art, p);
        allPlayers.push({ ...p, teamSlug });
      });
      patchTeamQuick(blockId, data.players);
      renderMapStats(document.getElementById(mapId), data.mapStats);
    });

    // ── Phase 2: Karten, die noch leer sind, einzeln über den Nickname holen ──
    const patchedNicks = new Set(allPlayers.map(p => p.nickname.toLowerCase()));
    const missing = [];
    for (const { teamSlug, blockId } of TEAM_BLOCKS) {
      const block = document.getElementById(blockId);
      if (!block) continue;
      block.querySelectorAll('[data-nickname]').forEach(card => {
        const nick = card.dataset.nickname;
        if (nick && nick !== 'TBA' && !patchedNicks.has(nick.toLowerCase())) {
          missing.push({ nick, teamSlug, card });
        }
      });
    }

    if (missing.length) {
      console.info(`[DieDonuts] Phase-2 Nickname-Fallback für ${missing.length} Spieler`);
      await Promise.all(missing.map(async ({ nick, teamSlug, card }) => {
        const p = await fetchPlayerProfile(null, nick).catch(() => null);
        if (!p || !p.elo) return;
        const stats = await fetchPlayerStats(p.faceitId).catch(() => null);
        patchCard(card, { ...p, stats: stats || {} });
        allPlayers.push({ ...p, stats: stats || {}, teamSlug });
      }));
      for (const { teamSlug, blockId } of TEAM_BLOCKS) {
        const teamPlayers = allPlayers.filter(p => p.teamSlug === teamSlug);
        if (teamPlayers.length) patchTeamQuick(blockId, teamPlayers);
      }
    }
  }

  // ── Phase 3: ELO-Tabelle ──
  if (document.getElementById('elo-lb-list')) {
    let lb = allPlayers;
    if (!lb.length) {
      // Übersichtsseite ohne Spielerkarten — direkt aus stats.json
      lb = (await loadAllPlayers().catch(() => [])) || [];
    }
    if (lb.length) renderLeaderboard(lb);
  }
}

init();


const { safeUrl } = window.DonutsSecurity;
// ── Matches Page Logic ─────────────────────────────────────────
const TEAM_META = {
  main: { label: 'Main', dachcsUrl: 'https://dachcs.de/coverage/' },
  nxt:  { label: 'Nxt',  dachcsUrl: null },
  dns:  { label: 'DNS',  dachcsUrl: null },
};

const DONUTS_NAMES = ['DIEDONUTS', 'Die Donuts', 'DieDonuts', 'DONUTS'];

// Offizielles Match = Liga oder Turnier. Alles aus einer offenen FACEIT-Queue
// ist ein Pug und zaehlt nicht als Org-Ergebnis.
function isOfficial(m) {
  if (m._src === 'dachcs') return true;
  const comp = (m.competition || '').toLowerCase();
  if (!comp) return false;
  if (/queue|matchmaking|ladder/.test(comp)) return false;
  if (/^team[_-]/i.test(m.teamName || '')) return false;
  return true;
}

// FACEIT-Lobbys heissen "team_nickname" — das braucht keiner zu sehen
const cleanName = (v) => String(v == null ? '?' : v).replace(/^team[_-]/i, '');
const escH = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

function empty(text = 'Keine Daten verfügbar') {
  return `<div class="matches-empty">
    <div class="matches-empty-icon">📋</div>
    <div>${text}</div>
  </div>`;
}

// ── Render upcoming match card (reuses nm-card styles) ────────
function renderUpcomingCard(m, teamSlug) {
  const meta = TEAM_META[teamSlug] || {};
  const dateStr = fmtDate(m.date);
  const us   = m.isHome !== false ? (m.team1 || 'DIEDONUTS') : (m.team2 || 'DIEDONUTS');
  const them = m.isHome !== false ? (m.team2 || m.opponent || '?') : (m.team1 || m.opponent || '?');
  // LIVE-Badge verlinkt direkt auf den eingetragenen Cast-Stream
  const vsHtml = m.isLive
    ? (m.caster
        ? `<a class="nm-vs nm-vs--live" href="https://www.twitch.tv/${encodeURIComponent(m.caster)}" target="_blank" rel="noopener" style="text-decoration:none;" title="Zum Stream von ${escH(m.caster)}"><span class="live-dot"></span>LIVE</a>`
        : `<div class="nm-vs nm-vs--live"><span class="live-dot"></span>LIVE</div>`)
    : `<div class="nm-vs">VS</div>`;
  const dachcsUrl  = m.faceitUrl || m.dachcsUrl || meta.dachcsUrl || 'https://dachcs.de';
  const linkLabel  = m._src === 'faceit' ? 'FACEIT' : 'DACHCS';
  const leagueLine = m.competition || [m.division, m.group, m.format || 'BO1'].filter(Boolean).join(' · ');
  const casterHtml = m.caster
    ? `<a href="https://www.twitch.tv/${encodeURIComponent(m.caster)}" target="_blank" rel="noopener" class="nm-caster-badge" aria-label="Cast von ${escH(m.caster)} auf Twitch">
        <svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11" aria-hidden="true"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
        CAST: ${escH(m.caster)}
      </a>`
    : '';
  return `<div class="nm-card${m.isLive ? ' nm-card--live' : ''}" data-team="${escH(teamSlug)}">
    <div class="nm-card-top">
      <span class="nm-roster-badge" data-team="${escH(teamSlug)}">${escH(meta.label || teamSlug)}</span>
      <span class="nm-league">${escH(leagueLine)}</span>
    </div>
    <div class="nm-matchup">
      <div class="nm-team nm-team--us">
        <span class="nm-team-name">${escH(cleanName(us))}</span>
        <span class="nm-team-label">WIR</span>
      </div>
      ${vsHtml}
      <div class="nm-team nm-team--opp">
        <span class="nm-team-name">${escH(cleanName(them))}</span>
        <span class="nm-team-label">GEGNER</span>
      </div>
    </div>
    <div class="nm-card-bottom">
      <div class="nm-datetime"><strong>${dateStr}</strong>${escH(m.time ? ' · ' + m.time + ' Uhr' : '')}</div>
      <a href="${escH(safeUrl(dachcsUrl))}" target="_blank" rel="noopener" class="nm-dachcs-link">${linkLabel} <span class="nm-arrow">→</span></a>
    </div>
    ${casterHtml}
  </div>`;
}

// ── Render result row ─────────────────────────────────────────
function renderResultRow(m, teamSlug, source = 'dachcs') {
  const meta     = TEAM_META[teamSlug] || {};
  const badgeCls = m.result === 'win' ? 'win' : m.result === 'loss' ? 'loss' : 'draw';
  const badgeTxt = m.result === 'win' ? 'WIN' : m.result === 'loss' ? 'LOSS' : 'DRAW';
  let league     = m.competition || [m.division, m.group, m.format].filter(Boolean).join(' · ');
  if (m.mapScores && m.mapScores.length) league += ` · Maps ${m.mapScores.join(' / ')}`;
  const linkUrl  = m.faceitUrl || m.dachcsUrl || (TEAM_META[teamSlug]?.dachcsUrl) || '#';
  const linkTxt  = m.faceitUrl ? 'FACEIT →' : 'DACHCS →';
  return `<div class="result-row" data-team="${escH(teamSlug)}">
    <div class="result-date">${fmtDate(m.date)}</div>
    <div class="result-match">
      <div class="result-opponent">${escH(cleanName(m.opponent))}<span class="team-chip" data-team="${escH(teamSlug)}">${escH(meta.label || teamSlug)}</span></div>
      <div class="result-meta">${escH(league || (source === 'faceit' ? 'FACEIT' : 'DACHCS'))}</div>
    </div>
    <div class="result-score">${escH(m.score || '—')}</div>
    <div>
      <span class="result-badge result-badge--${badgeCls}">${badgeTxt}</span>
      ${linkUrl !== '#' ? `<br><a href="${escH(safeUrl(linkUrl))}" target="_blank" rel="noopener" style="font-family:var(--font-mono);font-size:10px;color:var(--fg-4);letter-spacing:1px;text-decoration:none;margin-top:4px;display:inline-block;">${linkTxt}</a>` : ''}
    </div>
  </div>`;
}

// ── Render standings table ────────────────────────────────────
function renderStandings(standings, teamSlug) {
  if (!standings || !standings.length) return '';
  const meta = TEAM_META[teamSlug] || {};
  const rows = standings.map(s => {
    const isUs = DONUTS_NAMES.some(n => s.team.toLowerCase().includes(n.toLowerCase()));
    const rdCls = s.rd > 0 ? 'standings-rd-pos' : s.rd < 0 ? 'standings-rd-neg' : '';
    const rdTxt = s.rd > 0 ? `+${s.rd}` : `${s.rd}`;
    return `<tr>
      <td class="standings-pos">${escH(s.pos)}.</td>
      <td class="standings-team-name${isUs ? ' is-us' : ''}">${escH(s.team)}${isUs ? ' ★' : ''}</td>
      <td>${escH(s.played)}</td>
      <td>${escH(s.wins)}</td>
      <td>${escH(s.losses)}</td>
      <td class="${rdCls}">${escH(rdTxt)}</td>
      <td class="standings-pts">${escH(s.points)}</td>
    </tr>`;
  }).join('');
  return `
    <section class="matches-section">
      <div class="matches-section-header">
        <h2>Tabelle <span class="team-chip">${escH(meta.label)}</span></h2>
      </div>
      <div class="standings-wrap">
        <table class="standings-table">
          <thead><tr>
            <th>#</th><th>Team</th><th>Sp</th><th>S</th><th>N</th><th>RD</th><th>Pkt</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

// ── Main render ───────────────────────────────────────────────
let _data       = null;
let _activeTeam = 'all';
let _matchType  = 'official';

function renderAll() {
  const data   = _data;
  const filter = _activeTeam;
  const el     = document.getElementById('matchesContent');
  if (!el) return;

  if (!data) {
    el.innerHTML = empty('stats.json konnte nicht geladen werden.');
    return;
  }

  // Collect all upcoming across selected teams
  const teamKeys = filter === 'all' ? ['main','nxt','dns'] : [filter];
  let allUpcoming = [];
  let allRecent   = [];
  let standingsSections = '';

  for (const slug of teamKeys) {
    const t = data.teams?.[slug];
    if (!t) continue;

    // Upcoming (DACHCS + FACEIT/ESEA scheduled)
    (t.dachcsUpcoming   || []).forEach(m => allUpcoming.push({ ...m, _slug: slug, _src: 'dachcs' }));
    (t.faceitUpcoming   || []).forEach(m => allUpcoming.push({ ...m, _slug: slug, _src: 'faceit' }));

    // Recent (DACHCS + FACEIT)
    (t.dachcsRecent   || []).forEach(m => allRecent.push({ ...m, _slug: slug, _src: 'dachcs' }));
    (t.faceitMatches  || []).filter(m => m.result !== 'upcoming').forEach(m =>
      allRecent.push({ ...m, _slug: slug, _src: 'faceit' })
    );

    // Standings
    if ((t.standings || []).length) {
      standingsSections += renderStandings(t.standings, slug);
    }
  }

  // Duplikate entfernen: Liga-Matches tauchen bei DACHCS UND FACEIT auf.
  // DACHCS-Eintrag gewinnt (offizielles Liga-Ergebnis), FACEIT-Zwilling fliegt raus.
  const normName = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const nearDate = (a, b) => Math.abs(new Date(a) - new Date(b)) <= 2 * 86400000;
  const dachcsRecentKeys = allRecent
    .filter(m => m._src === 'dachcs')
    .map(m => ({ o: normName(m.opponent), d: m.date, s: m._slug }));
  allRecent = allRecent.filter(m =>
    m._src !== 'faceit' ||
    !dachcsRecentKeys.some(k => k.s === m._slug && k.o === normName(m.opponent) && nearDate(k.d, m.date))
  );

  // Wettbewerbsfilter: standardmaessig nur Liga und Turnier
  const hiddenPugs = _matchType === 'official'
    ? allUpcoming.filter(m => !isOfficial(m)).length + allRecent.filter(m => !isOfficial(m)).length
    : 0;
  if (_matchType === 'official') {
    allUpcoming = allUpcoming.filter(isOfficial);
    allRecent   = allRecent.filter(isOfficial);
  }

  // Sort
  allUpcoming.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  allRecent.sort((a, b)   => (b.date || '').localeCompare(a.date || ''));

  // Build HTML
  let html = '';

  // ── Upcoming ────────────────────────────────────────────────
  html += `<section class="matches-section">
    <div class="matches-section-header">
      <h2>Upcoming</h2>
      <span class="matches-count">${allUpcoming.length} Match${allUpcoming.length !== 1 ? 'es' : ''}</span>
    </div>`;
  if (allUpcoming.length) {
    html += `<div class="matches-grid">${allUpcoming.map(m => renderUpcomingCard(m, m._slug)).join('')}</div>`;
  } else {
    html += empty('Keine anstehenden Matches, schau später nochmal rein.');
  }
  html += `</section>`;

  // ── Results ──────────────────────────────────────────────────
  const displayRecent = allRecent.slice(0, 20);
  html += `<section class="matches-section">
    <div class="matches-section-header">
      <h2>Ergebnisse</h2>
      <span class="matches-count">${displayRecent.length} angezeigt</span>
    </div>`;
  if (displayRecent.length) {
    html += `<div class="results-list">${displayRecent.map(m => renderResultRow(m, m._slug, m._src)).join('')}</div>`;
  } else {
    html += empty('Noch keine Ergebnisse vorhanden.');
  }
  if (hiddenPugs) {
    html += `<div class="matches-hint">
      ${hiddenPugs} FACEIT-Queue-Match${hiddenPugs !== 1 ? 'es' : ''} ausgeblendet.
      <button type="button" class="matches-hint-link" data-show-all>Trotzdem anzeigen</button>
    </div>`;
  }
  html += `</section>`;

  // ── Standings ────────────────────────────────────────────────
  if (standingsSections) html += standingsSections;

  // ── Last updated ─────────────────────────────────────────────
  const updated = data.lastUpdated
    ? new Date(data.lastUpdated).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;
  const dachcsLink = data.teams?.main?.dachcsUrl || 'https://dachcs.de/coverage/';
  html += `<div class="matches-updated">
    <span>Daten zuletzt aktualisiert: ${updated || '—'}</span>
    <a href="${escH(safeUrl(dachcsLink))}" target="_blank" rel="noopener">DACHCS Coverage →</a>
  </div>`;

  el.innerHTML = html;
}

// ── Tabs ─────────────────────────────────────────────────────
document.getElementById('matchesTabs').addEventListener('click', function(e) {
  const btn = e.target.closest('.matches-tab');
  if (!btn) return;
  document.querySelectorAll('.matches-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  _activeTeam = btn.dataset.team;
  renderAll();
});

document.getElementById('matchesType').addEventListener('click', function(e) {
  const btn = e.target.closest('.matches-tab');
  if (!btn) return;
  document.querySelectorAll('#matchesType .matches-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  _matchType = btn.dataset.type;
  renderAll();
});

// "Trotzdem anzeigen" im Hinweis unter den Ergebnissen
document.addEventListener('click', function(e) {
  if (!e.target.closest('[data-show-all]')) return;
  _matchType = 'all';
  document.querySelectorAll('#matchesType .matches-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.type === 'all'));
  renderAll();
});

// ── Load stats.json ──────────────────────────────────────────
(async function() {
  try {
    const res = await fetch('/data/stats.json');
    if (!res.ok) throw new Error('stats.json not found');
    _data = await res.json();
  } catch(e) {
    console.warn('[matches] stats.json:', e);
    _data = null;
  }
  renderAll();
})();

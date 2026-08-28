/* ==========================================================================
   DONUTS ESPORTS — main.js
   --------------------------------------------------------------------------
   Handles:
     - Sticky nav scroll state
     - Mobile menu toggle
     - Active section highlight in nav
     - Scroll reveal animations
     - Player flip card click + keyboard interaction
     - Twitch live status check
   ========================================================================== */

(() => {
  'use strict';

  // Schutz vor doppeltem Einbinden: sonst haengen alle Klick-Handler zweimal
  // und heben sich gegenseitig auf (Spielerkarten drehen sich dann nicht mehr).
  if (window.__donutsMain) return;
  window.__donutsMain = true;

  // ---- Nav: scroll state -------------------------------------------------
  const nav = document.getElementById('nav');
  if (nav) {
    const setNavState = () => nav.classList.toggle('scrolled', window.scrollY > 24);
    setNavState();
    window.addEventListener('scroll', setNavState, { passive: true });
  }

  // ---- Mobile menu -------------------------------------------------------
  const menuBtn  = document.getElementById('menuBtn');
  const navLinks = document.getElementById('navLinks');
  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', () => {
      menuBtn.classList.toggle('open');
      navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        menuBtn.classList.remove('open');
        navLinks.classList.remove('open');
      });
    });
  }

  // ---- Active section highlight -----------------------------------------
  const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');
  const sectionMap = new Map();
  navAnchors.forEach(a => {
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (el) sectionMap.set(el, a);
  });
  if ('IntersectionObserver' in window && sectionMap.size) {
    const sectionObs = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            navAnchors.forEach(a => a.classList.remove('active'));
            const link = sectionMap.get(entry.target);
            if (link) link.classList.add('active');
          }
        });
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
    );
    sectionMap.forEach((_, el) => sectionObs.observe(el));
  }

  // ---- Reveal on scroll --------------------------------------------------
  // Karten in einem Grid versetzt einblenden statt alle gleichzeitig
  document.querySelectorAll('.roster-grid, .team-cards, .tp-panels, .nm-cards').forEach(grid => {
    [...grid.children].filter(el => el.classList.contains('reveal')).forEach((el, i) => {
      if (i > 0) el.style.transitionDelay = Math.min(i * 0.07, 0.5) + 's';
    });
  });

  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const revealObs = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            revealObs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    reveals.forEach(el => revealObs.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('in'));
  }

  // ---- Player flip cards -------------------------------------------------
  const players = document.querySelectorAll('.player');
  players.forEach(card => {
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    const name = card.querySelector('.player-name')?.textContent?.trim() || 'Player';
    card.setAttribute('aria-label', `${name}, Stats anzeigen`);

    const flip = (e) => {
      // Allow the FACEIT link on the back to be clickable without re-flipping
      if (e.target.closest('a')) return;
      card.classList.toggle('flipped');
      card.setAttribute('aria-pressed', card.classList.contains('flipped'));
    };
    card.addEventListener('click', flip);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        flip(e);
      }
    });
  });

  // ---- Smooth scroll for in-page anchors ---------------------------------
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length > 1) {
        const target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          const top = target.getBoundingClientRect().top + window.scrollY - 70;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      }
    });
  });

  // ---- ELO Leaderboard bar animation ------------------------------------
  const eloRows = document.querySelectorAll('.elo-lb-row');
  if ('IntersectionObserver' in window && eloRows.length) {
    let eloBarsTriggered = false;
    const eloObs = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !eloBarsTriggered) {
            eloBarsTriggered = true;
            eloRows.forEach((row, i) => {
              const bar = row.querySelector('.elo-lb-bar');
              if (!bar) return;
              const pct = parseFloat(bar.dataset.pct || 0) / 100;
              setTimeout(() => {
                bar.style.transform = `scaleX(${pct})`;
              }, 60 + i * 70);
            });
            eloObs.disconnect();
          }
        });
      },
      { threshold: 0.2 }
    );
    if (eloRows[0]) eloObs.observe(eloRows[0]);
  }

  // ---- Animated stat counters -------------------------------------------
  const counterEls = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && counterEls.length) {
    const countObs = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = parseFloat(el.dataset.count);
          const suffix = el.dataset.suffix || '';
          const duration = 1200;
          const start = performance.now();
          const isFloat = !Number.isInteger(target);

          const tick = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            const value = target * ease;
            el.textContent = (isFloat ? value.toFixed(1) : Math.round(value)) + suffix;
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          countObs.unobserve(el);
        });
      },
      { threshold: 0.5 }
    );
    counterEls.forEach(el => countObs.observe(el));
  }

  // ---- Map Bar Animation -------------------------------------------------
  const mapBars = document.querySelectorAll('.map-bar-fill');
  if ('IntersectionObserver' in window && mapBars.length) {
    const barObs = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const bar = entry.target;
            const pct = parseFloat(bar.dataset.pct || 0) / 100;
            bar.style.width = '100%';
            bar.style.transform = 'scaleX(0)';
            requestAnimationFrame(() => {
              setTimeout(() => {
                bar.style.transform = `scaleX(${pct})`;
              }, 100);
            });
            barObs.unobserve(bar);
          }
        });
      },
      { threshold: 0.4 }
    );
    mapBars.forEach(b => barObs.observe(b));
  }

  // ---- Gallery Lightbox --------------------------------------------------
  const galleryItems  = document.querySelectorAll('.gallery-item[data-src]');
  const lightbox      = document.getElementById('lightbox');
  const lightboxImg   = document.getElementById('lightboxImg');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxPrev  = document.getElementById('lightboxPrev');
  const lightboxNext  = document.getElementById('lightboxNext');

  if (lightbox && lightboxImg && galleryItems.length) {
    let current = 0;
    const srcs = [...galleryItems].map(el => el.dataset.src);

    const openLightbox = (idx) => {
      current = idx;
      lightboxImg.src = srcs[current];
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    };
    const closeLightbox = () => {
      lightbox.classList.remove('open');
      document.body.style.overflow = '';
    };

    galleryItems.forEach((item, i) => {
      item.addEventListener('click', () => {
        const img = item.querySelector('img');
        if (img && img.complete && img.naturalWidth > 0) openLightbox(i);
      });
    });

    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    lightboxPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      current = (current - 1 + srcs.length) % srcs.length;
      lightboxImg.src = srcs[current];
    });
    lightboxNext.addEventListener('click', (e) => {
      e.stopPropagation();
      current = (current + 1) % srcs.length;
      lightboxImg.src = srcs[current];
    });
    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') { current = (current - 1 + srcs.length) % srcs.length; lightboxImg.src = srcs[current]; }
      if (e.key === 'ArrowRight') { current = (current + 1) % srcs.length; lightboxImg.src = srcs[current]; }
    });
  }

  // =========================================================
  // LIVE-DATEN — eine Quelle für alles: /data/stats.json
  // Wird 2x täglich vom Scraper (GitHub Action) neu gebaut.
  // =========================================================
  let _statsPromise = null;
  function getStats(force) {
    if (force) _statsPromise = null;
    if (!_statsPromise) {
      _statsPromise = fetch('/data/stats.json')
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null);
    }
    return _statsPromise;
  }

  const ROSTER_LABELS = { main: 'Main Roster', nxt: 'Nxt Roster', dns: 'DNS Roster' };
  const SHORT_LABELS  = { main: 'Donuts',      nxt: 'Nxt',        dns: 'DNS' };
  const BADGE_LABELS  = { main: 'MAIN',        nxt: 'NXT',        dns: 'DNS' };

  // HTML-Escaping für alles, was aus dem Scraper kommt (fremde Teamnamen).
  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // Zeile der Donuts aus einer Tabelle fischen
  const ownRow = (t) => (t && t.standings || []).find(r => /DIEDONUTS/i.test(r.team || ''));

  // =========================================================
  // NÄCHSTE MATCHES
  // Kommen automatisch aus stats.json (DACHCS + FACEIT).
  // Die Liste hier ist nur für MANUELLE Zusatz-Einträge,
  // z.B. Showmatches, die in keiner Liga gelistet sind:
  //   { roster: 'Main Roster', teamName: 'Donuts', opponent: 'Gegner',
  //     league: 'Turnier', date: '2026-09-10T19:00', faceitUrl: '', castUrl: '' },
  // =========================================================
  const MATCHES = [
  ];

  async function fetchAutoMatches() {
    const out  = [];
    const data = await getStats();
    for (const [slug, t] of Object.entries((data && data.teams) || {})) {
      (t.dachcsUpcoming || []).forEach(m => {
        if (!m.date) return;
        const opp = m.isHome === false ? m.team1 : m.team2;
        out.push({
          roster:    ROSTER_LABELS[slug] || t.label || slug,
          teamName:  t.label,
          opponent:  opp || 'TBD',
          league:    m.competition || m.division || 'DACHCS',
          date:      `${m.date}T${m.time || '20:00'}`,
          faceitUrl: m.dachcsUrl || '',
          castUrl:   m.caster ? `https://www.twitch.tv/${m.caster}` : '',
        });
      });
      (t.faceitUpcoming || []).forEach(m => {
        if (!m.date) return;
        out.push({
          roster:    ROSTER_LABELS[slug] || t.label || slug,
          teamName:  t.label,
          opponent:  m.opponent || 'TBD',
          league:    m.competition || 'FACEIT',
          date:      `${m.date}T${m.time || '20:00'}`,
          faceitUrl: m.faceitUrl || '',
          castUrl:   '',
        });
      });
    }
    return out;
  }

  // Letzte Liga-Ergebnisse — der Fallback, damit die Sektion nie leer wirkt.
  // Bewusst nur DACHCS: FACEIT-Pugs aus der Europe-Queue sind kein Org-Ergebnis.
  async function fetchRecentResults() {
    const out  = [];
    const data = await getStats();
    for (const [slug, t] of Object.entries((data && data.teams) || {})) {
      (t.dachcsRecent || []).forEach(m => {
        if (!m.date) return;
        out.push({
          roster:   SHORT_LABELS[slug] || t.label || slug,
          teamName: t.label || 'Donuts',
          opponent: m.opponent || '?',
          league:   [m.competition, m.division].filter(Boolean).join(' · ') || 'DACHCS',
          date:     m.date,
          score:    m.score || '',
          result:   m.result || '',
          url:      m.dachcsUrl || '',
        });
      });
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }

  function renderNoMatch(container) {
    container.innerHTML = `<div class="nm-no-match">
      <span class="nm-no-match-title">Ein Spiel mit uns?</span>
      <span class="nm-no-match-sub">Gerne, meld dich auf <a href="https://discord.gg/GEPrazXBrJ" target="_blank" rel="noopener">Discord</a>.</span>
    </div>`;
  }

  function setMatchesEyebrow(text) {
    const eb = document.querySelector('.next-match-section .eyebrow');
    if (eb) eb.textContent = text;
  }

  function renderRecentResults(list) {
    const container = document.getElementById('nmCards');
    if (!container) return;
    setMatchesEyebrow(list && list.length ? 'Letzte Ergebnisse' : 'Nächste Matches');
    if (!list || !list.length) { renderNoMatch(container); return; }

    const cards = list.slice(0, 3).map(m => {
      const d = new Date(m.date + 'T12:00:00');
      const dateStr = isNaN(d) ? m.date : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const won = m.result === 'win';
      return `
      <div class="nm-card nm-card--result ${won ? 'is-win' : 'is-loss'}">
        <div class="nm-card-top">
          <span class="nm-roster-badge">${esc(m.roster)}</span>
          <span class="nm-league">${esc(m.league)}</span>
        </div>
        <div class="nm-matchup">
          <div class="nm-team nm-team--us">
            <span class="nm-team-name">${esc(m.teamName)}</span>
            <span class="nm-team-label">WIR</span>
          </div>
          <div class="nm-vs nm-vs--score ${won ? 'is-win' : 'is-loss'}">${esc(m.score || '–')}</div>
          <div class="nm-team nm-team--opp">
            <span class="nm-team-name">${esc(m.opponent)}</span>
            <span class="nm-team-label">GEGNER</span>
          </div>
        </div>
        <div class="nm-card-bottom">
          <div class="nm-datetime"><strong>${dateStr}</strong> · ${won ? 'Sieg' : 'Niederlage'}</div>
          ${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener" class="nm-dachcs-link">DACHCS <span class="nm-arrow">→</span></a>` : ''}
        </div>
      </div>`;
    }).join('');

    container.innerHTML =
      `<div class="nm-recent-note">Gerade läuft keine Liga-Runde. Hier die letzten Ergebnisse.</div>` + cards;
  }

  function renderNmCards(matches) {
    const container = document.getElementById('nmCards');
    if (!container) return;

    container.innerHTML = matches.map(m => {
      const now = new Date();
      const matchDate = new Date(m.date);
      const isLive = m.live || (matchDate <= now && now - matchDate < 2 * 3600 * 1000);

      const dateStr = matchDate.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
      const timeStr = matchDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

      return `
      <div class="nm-card${isLive ? ' nm-card--live' : ''}">
        <div class="nm-card-top">
          <span class="nm-roster-badge">${esc(m.roster)}</span>
          <span class="nm-league">${esc(m.league || 'FACEIT')}</span>
        </div>
        <div class="nm-matchup">
          <div class="nm-team nm-team--us">
            <span class="nm-team-name">${esc(m.teamName || 'Donuts')}</span>
            <span class="nm-team-label">WIR</span>
          </div>
          ${isLive
            ? '<div class="nm-vs nm-vs--live"><span class="live-dot"></span>LIVE</div>'
            : '<div class="nm-vs">VS</div>'}
          <div class="nm-team nm-team--opp">
            <span class="nm-team-name">${esc(m.opponent || 'TBD')}</span>
            <span class="nm-team-label">GEGNER</span>
          </div>
        </div>
        <div class="nm-card-bottom">
          <div class="nm-datetime"><strong>${dateStr}</strong> um ${timeStr} Uhr</div>
          <div class="nm-card-links">
            ${m.faceitUrl ? `<a href="${esc(m.faceitUrl)}" target="_blank" rel="noopener" class="nm-dachcs-link">Match-Room <span class="nm-arrow">→</span></a>` : ''}
            ${m.castUrl  ? `<a href="${esc(m.castUrl)}" target="_blank" rel="noopener" class="nm-dachcs-link" style="color:#9146ff;">Cast <span class="nm-arrow">→</span></a>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  async function loadNextMatches() {
    const container = document.getElementById('nmCards');
    if (!container) return;
    const now  = new Date();
    const auto = await fetchAutoMatches();

    const seen = new Set();
    const all  = [...MATCHES, ...auto].filter(m => {
      const key = `${(m.date || '').slice(0, 10)}|${(m.opponent || '').toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const upcoming = all
      .filter(m => new Date(m.date) > new Date(now - 2 * 3600 * 1000))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (upcoming.length) { setMatchesEyebrow('Nächste Matches'); renderNmCards(upcoming); }
    else                 renderRecentResults(await fetchRecentResults());
  }


  // ---- Partner aus /data/partners.json ------------------------------------
  async function initPartners() {
    const section = document.getElementById('partners');
    const grid    = document.getElementById('partnerGrid');
    if (!section || !grid) return;

    let data = null;
    try {
      const r = await fetch('/data/partners.json');
      if (r.ok) data = await r.json();
    } catch (e) { /* Sektion bleibt einfach aus */ }

    const entries = (data && Array.isArray(data.entries)) ? data.entries : [];
    if (!entries.length) return; // nichts eingetragen → Sektion bleibt versteckt

    grid.innerHTML = entries.map(p => {
      const inner = `
        ${p.logo ? `<img class="partner-logo" src="${esc(p.logo)}" alt="${esc(p.name)}" loading="lazy" onerror="this.remove()">` : ''}
        <div class="partner-body">
          ${p.tag ? `<span class="partner-tag">${esc(p.tag)}</span>` : ''}
          <h3 class="partner-name">${esc(p.name || '')}</h3>
          ${p.text ? `<p class="partner-text">${esc(p.text)}</p>` : ''}
        </div>`;
      return p.url
        ? `<a class="partner-card" href="${esc(p.url)}" target="_blank" rel="noopener sponsored">${inner}</a>`
        : `<div class="partner-card">${inner}</div>`;
    }).join('');

    section.hidden = false;
  }

  // ---- Ticker-Leiste unter dem Hero ---------------------------------------
  async function initTicker() {
    const elComp = document.getElementById('tkComp');
    const elMain = document.getElementById('tkMain');
    const elNxt  = document.getElementById('tkNxt');
    if (!elComp && !elMain && !elNxt) return;

    const data = await getStats();
    if (!data) return;

    let competition = '';
    for (const t of Object.values(data.teams || {})) {
      const m = (t.dachcsUpcoming || [])[0] || (t.dachcsRecent || [])[0];
      if (m && m.competition) { competition = m.competition; break; }
    }
    if (elComp && competition) elComp.textContent = competition;

    const standingText = (t) => {
      const row = ownRow(t);
      return row ? `${row.pos}. · ${row.wins}W/${row.losses}L` : null;
    };
    const mainTxt = standingText(data.teams && data.teams.main);
    const nxtTxt  = standingText(data.teams && data.teams.nxt);
    if (elMain && mainTxt) elMain.textContent = mainTxt;
    if (elNxt  && nxtTxt)  elNxt.textContent  = nxtTxt;
  }

  // ---- Rotierende Zeile im Hero-Videorahmen -------------------------------
  async function initHeroRotate() {
    const el = document.getElementById('heroRotate');
    if (!el) return;
    const data = await getStats();
    if (!data) return;

    const lines = [];
    const teams = data.teams || {};

    // 1. Nächstes Match
    const upcoming = (await fetchAutoMatches())
      .filter(m => new Date(m.date) > new Date())
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
    if (upcoming) {
      const d = new Date(upcoming.date);
      lines.push(`Nächstes · ${upcoming.opponent} ${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`);
    }

    // 2. Letztes Liga-Ergebnis
    const last = (await fetchRecentResults())[0];
    if (last) lines.push(`${last.result === 'win' ? 'Sieg' : 'Niederlage'} ${last.score} vs ${last.opponent}`);

    // 3. Tabellenstände
    for (const slug of ['main', 'nxt']) {
      const t = teams[slug];
      const row = ownRow(t);
      if (!row) continue;
      lines.push(`${t.label} · Platz ${row.pos} von ${(t.standings || []).length}`);
    }

    if (!lines.length) return;
    el.style.transition = 'opacity 0.35s';
    el.textContent = lines[0];
    if (lines.length < 2) return;

    let i = 0;
    setInterval(() => {
      i = (i + 1) % lines.length;
      el.style.opacity = '0';
      setTimeout(() => { el.textContent = lines[i]; el.style.opacity = '1'; }, 350);
    }, 5000);
  }

  // ---- Spielerzahl im Hero ------------------------------------------------
  async function initPlayerCount() {
    const el = document.getElementById('statPlayers');
    if (!el) return;
    const data = await getStats();
    const count = (data && data.allPlayers && data.allPlayers.length) || 0;
    if (!count) return;
    el.dataset.count = count;
    // main.js zählt selbst hoch — kurz warten, dann auf den echten Wert nachziehen
    setTimeout(() => {
      const from  = parseInt(el.textContent, 10) || 0;
      if (from === count) return;
      const start = performance.now();
      const step = (now) => {
        const p = Math.min((now - start) / 800, 1);
        el.textContent = Math.round(from + (count - from) * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, 1400);
  }

  // ---- Highlights-Timeline aus /data/history.json --------------------------
  async function initAchievements() {
    const list = document.getElementById('achList');
    if (!list) return;

    let hist = null;
    try {
      const r = await fetch('/data/history.json');
      if (r.ok) hist = await r.json();
    } catch (e) { /* Fallback-Zeilen im HTML bleiben einfach stehen */ }
    if (!hist || !Array.isArray(hist.entries)) return;

    const rows = [];

    // Laufende Saison automatisch davorsetzen
    const data = await getStats();
    for (const slug of ['main', 'nxt', 'dns']) {
      const t = (data && data.teams) ? data.teams[slug] : null;
      const row = ownRow(t);
      if (!row) continue;
      const recent = (t.dachcsRecent || [])[0] || {};
      const comp = recent.competition || 'Liga';
      const div  = recent.division || '';
      rows.push({
        badge:    BADGE_LABELS[slug] || slug.toUpperCase(),
        title:    `${esc(t.label)} · ${esc(comp)}`,
        text:     `${div ? esc(div) + ' · ' : ''}Platz ${row.pos} von ${(t.standings || []).length} · ${row.wins}W / ${row.losses}L · Runden ${row.rd > 0 ? '+' : ''}${row.rd}`,
        tag:      'live',
        tagLabel: 'Läuft',
      });
    }

    rows.push(...hist.entries);

    list.innerHTML = rows.map(e => `
      <div class="ach-row">
        <div class="ach-year">${e.badge || ''}</div>
        <div>
          <h4>${e.title || ''}</h4>
          <p>${e.text || ''}</p>
        </div>
        <span class="ach-tag ${e.tag || ''}">${e.tagLabel || ''}</span>
      </div>`).join('');
  }

  loadNextMatches();
  initTicker();
  initHeroRotate();
  initPlayerCount();
  initAchievements();
  initPartners();

  // Alle 5 Minuten frische Daten holen
  setInterval(() => { getStats(true); loadNextMatches(); initTicker(); }, 5 * 60 * 1000);

  // ---- Twitch Live Status ------------------------------------------------
  //
  // Um echten Live-Status zu zeigen, brauchst du:
  // 1. Eine Twitch Developer App unter https://dev.twitch.tv/console
  // 2. Einen Client-ID und einen App Access Token
  // 3. Trage Client-ID und Token unten ein
  //
  // Twitch-Handles der Spieler bitte in TWITCH_CHANNELS anpassen!
  //
  // Credentials werden aus /data/twitch-token.json geladen (generiert via GitHub Actions)
  let TWITCH_CLIENT_ID = '';
  let TWITCH_TOKEN     = '';

  async function checkTwitchLive() {
    const streamCards = document.querySelectorAll('.stream-card[data-twitch]');
    // Homepage: Banner-Kanäle immer prüfen auch wenn keine stream-cards da sind
    const bannerHandles = ['diedonuts_esports','tube_y0u','justkristinthings','derohnedaumen','sirokkoko'];
    const bannerNames   = { diedonuts_esports:'DieDonuts Esports', tube_y0u:'TubeYou', justkristinthings:'Kriistiin_', derohnedaumen:'-_-Calli', sirokkoko:'sirokkoko' };
    if (!streamCards.length && !document.getElementById('liveBanner')) return;

    // Ohne API-Key: nichts tun (Cards bleiben OFFLINE)
    if (!TWITCH_CLIENT_ID || !TWITCH_TOKEN) {
      console.info('[Donuts Streams] Kein Twitch API-Key konfiguriert. Live-Status nicht verfügbar.');
      return;
    }

    // Alle bekannten Handles kombinieren (stream-cards + banner-handles)
    const cardHandles  = [...streamCards].map(c => c.dataset.twitch);
    const allHandles   = [...new Set([...cardHandles, ...bannerHandles])];
    const handles      = allHandles.map(h => `user_login=${encodeURIComponent(h)}`).join('&');

    try {
      const res = await fetch(`https://api.twitch.tv/helix/streams?${handles}`, {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${TWITCH_TOKEN}`
        }
      });

      if (!res.ok) {
        console.warn('[Donuts Streams] Twitch API Fehler:', res.status);
        return;
      }

      const data = await res.json();
      const liveMap = new Map();
      if (data.data) {
        data.data.forEach(stream => {
          liveMap.set(stream.user_login.toLowerCase(), stream.viewer_count);
        });
      }

      // Stream-Cards updaten (streams.html)
      streamCards.forEach(card => {
        const handle   = (card.dataset.twitch || '').toLowerCase();
        const statusEl = card.querySelector('.stream-status');
        const statusTx = card.querySelector('.status-text');
        const viewerEl = card.querySelector('.stream-viewer-count');
        if (liveMap.has(handle)) {
          const viewers = liveMap.get(handle);
          statusEl.className    = 'stream-status live';
          statusTx.textContent  = 'LIVE';
          card.classList.add('is-live');
          if (viewerEl) viewerEl.textContent = `${viewers.toLocaleString('de-DE')} Zuschauer`;
        } else {
          statusEl.className    = 'stream-status offline';
          statusTx.textContent  = 'OFFLINE';
          card.classList.remove('is-live');
          if (viewerEl) viewerEl.textContent = '';
        }
      });

      // Homepage Live-Banner updaten
      const banner = document.getElementById('liveBanner');
      const bannerInner = document.getElementById('liveBannerInner');
      if (banner && bannerInner && liveMap.size > 0) {
        const liveItems = [...liveMap.entries()].map(([handle, viewers]) => {
          const name = bannerNames[handle] || handle;
          const url  = `https://www.twitch.tv/${handle}`;
          return `<a class="live-banner-item" href="${url}" target="_blank" rel="noopener">
            <span class="live-dot-purple"></span>
            <strong>${name}</strong>
            <span style="color:var(--fg-3);font-size:11px;">${viewers.toLocaleString('de-DE')} Zuschauer</span>
          </a>`;
        }).join('');
        bannerInner.innerHTML = `<div class="live-banner-header">⬤ Jetzt live auf Twitch</div>${liveItems}`;
        banner.style.display = 'block';
        setTimeout(() => banner.classList.add('is-visible'), 10);
      } else if (banner) {
        banner.classList.remove('is-visible');
        setTimeout(() => { banner.style.display = 'none'; }, 400);
      }

    } catch (err) {
      console.warn('[Donuts Streams] Twitch-Check fehlgeschlagen:', err);
    }
  }

  // Token laden, dann sofort prüfen und alle 5 Minuten wiederholen
  async function initTwitch() {
    try {
      const cfg = await fetch('/data/twitch-token.json').then(r => r.ok ? r.json() : null);
      if (cfg) {
        TWITCH_CLIENT_ID = cfg.client_id || '';
        TWITCH_TOKEN     = cfg.access_token || '';
      }
    } catch (e) {
      console.info('[Donuts Streams] twitch-token.json nicht verfügbar.');
    }
    checkTwitchLive();
    setInterval(checkTwitchLive, 5 * 60 * 1000);
  }

  initTwitch();

})();

// ---- Particle Background Canvas ----------------------------------------
(function initParticles() {
  if (window.__donutsParticles) return;
  window.__donutsParticles = true;
  const canvas = document.createElement('canvas');
  canvas.id = 'particleCanvas';
  document.body.insertBefore(canvas, document.body.firstChild);
  const ctx = canvas.getContext('2d');

  let W, H, particles = [];
  const COUNT = 90;

  // Akzentfarbe der Seite übernehmen (Team-Seiten haben eigene)
  function readAccent() {
    const v = getComputedStyle(document.body).getPropertyValue('--accent').trim();
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(v);
    if (m) return `${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)}`;
    const rgb = /rgba?\(([^)]+)\)/.exec(v);
    if (rgb) return rgb[1].split(',').slice(0,3).map(x => x.trim()).join(',');
    return '225,29,72';
  }
  let accentRGB = readAccent();

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.8 + 0.4,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      o: Math.random() * 0.6 + 0.2,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${accentRGB},${p.o})`;
      ctx.fill();
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

// ---- Konami Code — Donut Rain ------------------------------------------
(function initKonami() {
  if (window.__donutsKonami) return;
  window.__donutsKonami = true;
  const CODE = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let pos = 0;

  document.addEventListener('keydown', (e) => {
    if (e.key === CODE[pos]) {
      pos++;
      if (pos === CODE.length) {
        pos = 0;
        donutRain();
      }
    } else {
      pos = e.key === CODE[0] ? 1 : 0;
    }
  });

  function donutRain() {
    const count = 40;
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const d = document.createElement('span');
        d.className = 'konami-donut';
        d.textContent = '🍩';
        d.style.left = Math.random() * 100 + 'vw';
        d.style.animationDuration = (Math.random() * 2 + 1.5) + 's';
        d.style.fontSize = (Math.random() * 1.5 + 1.5) + 'rem';
        document.body.appendChild(d);
        d.addEventListener('animationend', () => d.remove());
      }, i * 80);
    }
  }
})();

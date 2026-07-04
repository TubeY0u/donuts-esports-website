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
    card.setAttribute('aria-label', `${name} — click to view detailed stats`);

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
  // NÄCHSTE MATCHES
  // Werden AUTOMATISCH aus /data/stats.json geladen (DACHCS +
  // FACEIT, täglich vom Scraper aktualisiert).
  // Die Liste unten ist nur für MANUELLE Zusatz-Einträge
  // (z.B. Showmatches, die nirgends gelistet sind):
  //   { roster: 'Main Roster', opponent: 'Gegner', league: 'Turnier', date: '2026-05-10T19:00', faceitUrl: '', castUrl: '' },
  // =========================================================
  const MATCHES = [
  ];
  // =========================================================

  const ROSTER_LABELS = { main: 'Main Roster', nxt: 'Nxt Roster', dns: 'DNS Roster' };
  let _autoMatchesCache = null;

  async function fetchAutoMatches() {
    if (_autoMatchesCache) return _autoMatchesCache;
    const out = [];
    try {
      const res = await fetch('/data/stats.json');
      if (res.ok) {
        const data = await res.json();
        for (const [slug, t] of Object.entries(data.teams || {})) {
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
      }
    } catch (e) {
      console.info('[Donuts Matches] stats.json nicht verfügbar:', e);
    }
    _autoMatchesCache = out;
    return out;
  }

  function renderNmCards(matches) {
    const container = document.getElementById('nmCards');
    if (!container) return;

    if (!matches || matches.length === 0) {
      container.innerHTML = '<div class="nm-no-match">Aktuell keine Matches geplant — check unseren Discord für Updates.</div>';
      return;
    }

    container.innerHTML = matches.map(m => {
      const now = new Date();
      const matchDate = new Date(m.date);
      const isLive = m.live || (matchDate <= now && now - matchDate < 2 * 3600 * 1000);

      const dateStr = matchDate.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
      const timeStr = matchDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

      return `
      <div class="nm-card">
        <div class="nm-card-top">
          <span class="nm-roster-badge">${m.roster}</span>
          <span class="nm-league">${m.league || 'FACEIT'}</span>
        </div>
        <div class="nm-matchup">
          <div class="nm-team nm-team--us">
            <div class="nm-team-label">Wir</div>
            <div class="nm-team-name">${m.teamName || 'Donuts'}</div>
          </div>
          <div class="nm-vs">VS</div>
          <div class="nm-team nm-team--opp">
            <div class="nm-team-label">Gegner</div>
            <div class="nm-team-name">${m.opponent || 'TBD'}</div>
          </div>
        </div>
        <div class="nm-card-bottom">
          <div class="nm-datetime">
            ${isLive
              ? '<span class="nm-status-live"><span class="live-dot"></span> LIVE JETZT</span>'
              : `<strong>${dateStr}</strong> um ${timeStr} Uhr`}
          </div>
          <div class="nm-card-links">
            ${m.faceitUrl ? `<a href="${m.faceitUrl}" target="_blank" rel="noopener" class="btn btn-ghost" style="padding:6px 14px;font-size:12px;">Match-Room →</a>` : ''}
            ${m.castUrl  ? `<a href="${m.castUrl}"  target="_blank" rel="noopener" class="btn btn-ghost" style="padding:6px 14px;font-size:12px;color:#9146ff;">📺 Cast</a>` : ''}
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

    // Manuelle + automatische Einträge kombinieren, Duplikate raus
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
    renderNmCards(upcoming);
  }

  loadNextMatches();
  setInterval(loadNextMatches, 60 * 1000);

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
  const canvas = document.createElement('canvas');
  canvas.id = 'particleCanvas';
  document.body.insertBefore(canvas, document.body.firstChild);
  const ctx = canvas.getContext('2d');

  let W, H, particles = [];
  const COUNT = 90;

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
      ctx.fillStyle = `rgba(225,29,72,${p.o})`;
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

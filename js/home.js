/* Logo-Portale (nur Startseite), Hell/Dunkel-Schalter und Easter Eggs (alle Seiten). Der Konami-Code (Donut-Regen) wohnt in main.js. */
(() => {
  'use strict';
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 0) Portale: Beim Scrollen fliegt die Kamera ins Logo. data-portal="hole" fliegt durchs Loch im D
  //    (dahinter ein Foto), "ink" in den Strich des C (danach ist alles Logofarbe). Die Klasse .zoom
  //    setzt theme.js, sie fehlt bei reduzierter Bewegung. Pro Frame nur Transforms und Opacity.
  const clamp = v => Math.min(1, Math.max(0, v));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  const bottom = el => el ? el.offsetTop + el.offsetHeight : 0;

  function portal(sec) {
    const stage = sec.querySelector('.portal-stage'), logo = sec.querySelector('.portal-logo');
    const hole = sec.dataset.portal === 'hole';
    const fx = +sec.dataset.fx, fy = +sec.dataset.fy, clear = +sec.dataset.clear, facesAt = +sec.dataset.peek || 0;
    // Passt der Inhalt nicht auf die klebende Bühne (200 % Zoom, sehr flaches Fenster), bleibt es statisch.
    // ponytail: nur beim Laden geprüft, nicht nach späterem Resize
    const tallest = Math.max(...[...stage.querySelectorAll('.portal-copy:not(.season), .portal-logo')].map(bottom));
    const afterTooTall = [...stage.querySelectorAll('.portal-after')].some(el => {
      const first = el.firstElementChild, last = el.lastElementChild;
      return bottom(last) - first.offsetTop > stage.clientHeight - 48;
    });
    if (tallest > stage.clientHeight - 48 || afterTooTall) { sec.classList.add('is-static'); return; }

    const zoomEnd = hole ? .7 : .6, afterFrom = hole ? .72 : .62;
    let dx = 0, dy = 0, peek = 0, sMax = 8, stickTop = 72, ticking = false, onScreen = false;
    // ponytail: misst nur bei Resize/Fonts neu; verschiebt sich das Layout anders (Live-Banner), sitzt die Mitte leicht daneben
    const set = (k, v) => stage.style.setProperty(k, v);
    const update = () => {
      ticking = false;
      const r = sec.getBoundingClientRect();
      const p = clamp((stickTop - r.top) / (r.height - stage.offsetHeight));
      const z = ease(clamp(p / zoomEnd));
      const s = sMax ** z;                         // exponentiell, fühlt sich wie gleichmäßiges Fliegen an
      set('--s', s); set('--is', 1 / s);           // Foto im Loch skaliert gegen, bleibt also gleich groß
      set('--iy', peek * (1 - z) / s + 'px');
      set('--tx', -dx * z + 'px'); set('--ty', -dy * z + 'px'); // Fokuspunkt wandert in die Bühnenmitte
      const cp = clamp(p / .22), lp = ease(clamp((p - afterFrom) / .2));
      set('--cp', cp); set('--lp', lp);
      if (hole) set('--shade', clamp((p - .5) / .25));
      sec.classList.toggle('is-zoomed', cp > .98);
      sec.classList.toggle('is-full', z > .995);
      sec.classList.toggle('is-after', lp > 0);
    };
    const measure = () => {
      const w = stage.clientWidth, h = stage.clientHeight, lw = logo.offsetWidth;
      dx = logo.offsetLeft + fx * lw - w / 2;      // offset* ignoriert Transforms
      dy = logo.offsetTop + fy * logo.offsetHeight - h / 2;
      sMax = Math.hypot(w, h) / (clear * lw) * 1.08;
      // data-peek: diese Fotohöhe (z. B. die Köpfe) anfangs ins Loch schieben (Foto 4:3, cover, object-position y 70 %)
      const H = Math.max(h, w * .75);
      peek = facesAt ? h / 2 - ((h - H) * .7 + H * facesAt) : 0;
      stickTop = parseFloat(getComputedStyle(stage).top) || 0;
      set('--sw', w + 'px'); set('--sh', h + 'px');
      update();
    };
    const onScroll = () => { if (onScreen && !ticking) { ticking = true; requestAnimationFrame(update); } };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', measure);
    document.fonts?.ready.then(measure);
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; onScroll(); }).observe(sec);
    measure();
  }
  if (document.documentElement.classList.contains('zoom')) document.querySelectorAll('[data-portal]').forEach(portal);
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function toast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 3600);
  }

  const SPRINKLES = ['#ffcf3a', '#2fd39f', '#6d8bff', '#ffffff', '#ff3866'];
  function sprinkleRain(n = 60) {
    if (calm) return;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'fall-sprinkle';
      s.style.left = Math.random() * 100 + 'vw';
      s.style.background = SPRINKLES[i % SPRINKLES.length];
      s.style.animationDuration = 1.6 + Math.random() * 1.8 + 's';
      s.style.animationDelay = Math.random() * 0.8 + 's';
      document.body.appendChild(s);
      s.addEventListener('animationend', () => s.remove());
    }
  }

  // 1) Fünfmal aufs Logo tippen: jemand beißt in den Donut.
  const brand = document.getElementById('brand');
  const photo = document.getElementById('donutPhoto');
  let clicks = 0, clickTimer;
  brand?.addEventListener('click', (e) => {
    clicks++;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { clicks = 0; }, 1500);
    if (location.pathname === '/' || clicks > 1) e.preventDefault();
    brand.classList.toggle('is-bitten');
    if (clicks === 5) {
      clicks = 0;
      photo?.classList.toggle('bite');
      toast(photo?.classList.contains('bite') ? 'Wer hat da reingebissen?' : 'Okay, neuer Donut. Frisch aus dem Ofen.');
      sprinkleRain(40);
    }
  });

  // 2) Irgendwo "rushb" tippen.
  const WORDS = {
    rushb:  'Rush B? Wir spielen Taktik. Meistens.',
    eco:    'Eco-Runde? Ein Donut kostet trotzdem nix.',
    ace:    'Ace! Das gibt Streusel.',
    gg:     'GG WP. Die Donuts gehen auf uns.',
    defuse: 'Bombe entschärft. Der Donut lebt.',
    donut:  'Jemand hat Donut gesagt?',
  };
  let typed = '';
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea') || e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-8);
    for (const [w, msg] of Object.entries(WORDS)) {
      if (typed.endsWith(w)) {
        typed = '';
        toast(msg);
        if (w === 'ace') sprinkleRain(80);
        if (w === 'donut' && !calm) { // das Hero-Logo dreht sich einmal um sich selbst
          photo?.classList.remove('spin'); void photo?.offsetWidth; photo?.classList.add('spin');
        }
      }
    }
  });

  // 3) Hell/Dunkel. Hell heißt hier Flashbang.
  const themeBtn = document.getElementById('themeBtn');
  const root = document.documentElement;
  const syncThemeBtn = () => {
    const light = root.dataset.theme === 'light';
    themeBtn?.setAttribute('aria-pressed', String(light));
    themeBtn?.setAttribute('aria-label', light ? 'Dunkles Design einschalten' : 'Helles Design einschalten');
  };
  syncThemeBtn();
  themeBtn?.addEventListener('click', () => {
    const light = root.dataset.theme !== 'light';
    if (light) root.dataset.theme = 'light'; else delete root.dataset.theme;
    try { localStorage.setItem('donuts-theme', light ? 'light' : 'dark'); } catch (e) {}
    syncThemeBtn();
    if (light && !calm) {
      const fx = document.createElement('div');
      fx.className = 'flash-fx';
      document.body.appendChild(fx);
      fx.addEventListener('animationend', () => fx.remove());
    }
    toast(light ? 'Flashbang! Hättest dich wegdrehen sollen.' : 'Augen wieder auf. Willkommen zurück im Dunkeln.');
  });

  // 4) Für alle, die in die Konsole schauen.
  console.log([
    '%c        .:::::::.',
    '     .:::::::::::::.',
    '   .::::::\'   \':::::.',
    '   ::::::       ::::::',
    '   \'::::::.   .:::::\'',
    '     \':::::::::::::\'',
    '        \':::::::\'',
    '',
    'Hey, du schaust in die Konsole?',
  ].join('\n'), 'font: 700 14px monospace; color: #ff3866');
  console.log('Dann bist du hier richtig: https://discord.gg/GEPrazXBrJ\nPsst: Tipp mal "rushb", "eco", "ace", "gg" oder "donut" auf der Seite. Und das Logo mag es, angetippt zu werden.');
})();

/* Startseite: Donut-Zoom im Hero und Easter Eggs. Der Konami-Code (Donut-Regen) wohnt in main.js. */
(() => {
  'use strict';
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 0) Hero: Beim Scrollen fliegt die Kamera durchs Donut-Loch. Die Klasse .zoom setzt theme.js
  //    (fehlt bei reduzierter Bewegung, dann bleibt alles stehen). Nur Transforms, kein Layout pro Frame.
  const hero = document.getElementById('hero');
  const stage = hero?.querySelector('.hero-stage');
  // Passt der Inhalt nicht auf die klebende Bühne (200 % Zoom, sehr flaches Fenster), lieber statisch.
  // ponytail: wird nur beim Laden geprüft, nicht nach späterem Resize
  const bottom = el => el ? el.offsetTop + el.offsetHeight : 0;
  if (stage && Math.max(bottom(stage.querySelector('.hero-copy')), bottom(stage.querySelector('.donut'))) > stage.clientHeight - 48) {
    document.documentElement.classList.remove('zoom');
  }
  if (stage && document.documentElement.classList.contains('zoom')) {
    const donut = hero.querySelector('.donut');
    const clamp = v => Math.min(1, Math.max(0, v));
    const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    let dx = 0, dy = 0, peek = 0, sMax = 8, stickTop = 72, ticking = false, onScreen = true;
    // ponytail: misst nur bei resize/Fonts neu; ändert sich das Layout anders (Live-Banner), stimmt die Mitte leicht nicht
    const set = (k, v) => stage.style.setProperty(k, v);

    const update = () => {
      ticking = false;
      const r = hero.getBoundingClientRect();
      const p = clamp((stickTop - r.top) / (r.height - stage.offsetHeight));
      const z = ease(clamp(p / .7));      // Zoom-Fortschritt
      const s = sMax ** z;                // exponentiell, fühlt sich wie gleichmäßiges Fliegen an
      set('--s', s); set('--is', 1 / s);  // Foto im Loch skaliert gegen, bleibt also gleich groß
      set('--iy', peek * (1 - z) / s + 'px'); // am Anfang die Köpfe ins Loch schieben
      set('--tx', -dx * z + 'px'); set('--ty', -dy * z + 'px'); // Donut wandert dabei in die Bühnenmitte
      const cp = clamp(p / .22), lp = ease(clamp((p - .72) / .2));
      set('--cp', cp); set('--lp', lp); set('--shade', clamp((p - .5) / .25));
      stage.classList.toggle('is-zoomed', cp > .98);
      stage.classList.toggle('is-full', z > .995);
      stage.classList.toggle('is-lineup', lp > 0);
    };
    const measure = () => {
      const w = stage.clientWidth, h = stage.clientHeight;
      dx = donut.offsetLeft + donut.offsetWidth / 2 - w / 2;   // offset* ignoriert Transforms
      dy = donut.offsetTop + donut.offsetHeight / 2 - h / 2;
      sMax = Math.hypot(w, h) / (donut.offsetWidth * .37) * 1.06;
      // Köpfe sitzen bei ~58 % der Fotohöhe; Foto ist 4:3, object-fit cover, object-position y 72 %
      const H = Math.max(h, w * .75);
      peek = h / 2 - ((h - H) * .72 + H * .58);
      stickTop = parseFloat(getComputedStyle(stage).top) || 0;
      set('--sw', w + 'px'); set('--sh', h + 'px');
      update();
    };
    const onScroll = () => { if (onScreen && !ticking) { ticking = true; requestAnimationFrame(update); } };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', measure);
    document.fonts?.ready.then(measure);
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; onScroll(); }).observe(hero);
    measure();
  }
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function toast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 3600);
  }

  const SPRINKLES = ['#ffcf3a', '#3fd0a8', '#6d8bff', '#fff6ef', '#ff5fa8'];
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
        if (w === 'donut' && !calm) { // der Hero-Donut dreht sich einmal um sich selbst
          const ring = document.querySelector('.donut-ring');
          ring?.classList.remove('spin'); void ring?.offsetWidth; ring?.classList.add('spin');
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
  ].join('\n'), 'font: 700 14px monospace; color: #ff5fa8');
  console.log('Dann bist du hier richtig: https://discord.gg/GEPrazXBrJ\nPsst: Tipp mal "rushb", "eco", "ace", "gg" oder "donut" auf der Seite. Und das Logo mag es, angetippt zu werden.');
})();

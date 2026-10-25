/* Join-Portal und Fenster-Effekt (nur Startseite), Hell/Dunkel-Schalter und Easter Eggs (alle Seiten). Der Konami-Code (Donut-Regen) wohnt in main.js. */
(() => {
  'use strict';
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 0) Join-Portal: Beim Scrollen fliegt die Kamera in den Strich des C, bis alles Logofarbe ist.
  //    data-fx/fy = Fokuspunkt, data-clear = Strichbreite (relativ zum Logo). Die Klasse .zoom setzt
  //    theme.js, sie fehlt bei reduzierter Bewegung. Pro Frame nur Transforms und Opacity.
  const clamp = v => Math.min(1, Math.max(0, v));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  const bottom = el => el ? el.offsetTop + el.offsetHeight : 0;

  function portal(sec) {
    const stage = sec.querySelector('.portal-stage'), logo = sec.querySelector('.portal-logo');
    const fx = +sec.dataset.fx, fy = +sec.dataset.fy, clear = +sec.dataset.clear;
    // Passt der Inhalt nicht auf die klebende Bühne (200 % Zoom, sehr flaches Fenster), bleibt es statisch.
    // ponytail: nur beim Laden geprüft, nicht nach späterem Resize
    const tooTall = [...stage.querySelectorAll('.portal-after')].some(el =>
      bottom(el.lastElementChild) - el.firstElementChild.offsetTop > stage.clientHeight - 48);
    if (bottom(logo) > stage.clientHeight - 48 || tooTall) { sec.classList.add('is-static'); return; }

    let dx = 0, dy = 0, sMax = 8, stickTop = 72, ticking = false, onScreen = false;
    // ponytail: misst nur bei Resize/Fonts neu; verschiebt sich das Layout anders (Live-Banner), sitzt die Mitte leicht daneben
    const set = (k, v) => stage.style.setProperty(k, v);
    const update = () => {
      ticking = false;
      const r = sec.getBoundingClientRect();
      const p = clamp((stickTop - r.top) / (r.height - stage.offsetHeight));
      const z = ease(clamp(p / .6));
      set('--s', sMax ** z);                       // exponentiell, fühlt sich wie gleichmäßiges Fliegen an
      set('--tx', -dx * z + 'px'); set('--ty', -dy * z + 'px'); // Fokuspunkt wandert in die Bühnenmitte
      const lp = ease(clamp((p - .62) / .2));
      set('--lp', lp);
      sec.classList.toggle('is-full', z > .995);
      sec.classList.toggle('is-after', lp > 0);
    };
    const measure = () => {
      const w = stage.clientWidth, h = stage.clientHeight, lw = logo.offsetWidth;
      dx = logo.offsetLeft + fx * lw - w / 2;      // offset* ignoriert Transforms
      dy = logo.offsetTop + fy * logo.offsetHeight - h / 2;
      sMax = Math.hypot(w, h) / (clear * lw) * 1.08;
      stickTop = parseFloat(getComputedStyle(stage).top) || 0;
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

  // 0b) Hero: Das Foto im Logo-Loch driftet beim Wegscrollen langsamer als die Seite (Fenster-Effekt).
  const heroWin = document.querySelector('.hero .portal-window');
  if (heroWin && document.documentElement.classList.contains('zoom')) {
    let busy = false;
    const drift = () => {
      busy = false;
      const r = heroWin.getBoundingClientRect();
      heroWin.style.setProperty('--py', clamp(1 - r.bottom / (innerHeight + r.height)).toFixed(3));
    };
    addEventListener('scroll', () => { if (!busy && scrollY < innerHeight * 1.5) { busy = true; requestAnimationFrame(drift); } }, { passive: true });
    drift();
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
    if (location.pathname === '/' && clicks === 1) scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' }); // ein Klick: zurück nach oben
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

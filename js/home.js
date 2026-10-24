/* Startseite: Easter Eggs. Der Konami-Code (Donut-Regen) wohnt in main.js. */
(() => {
  'use strict';
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    rushb: 'Rush B? Wir spielen Taktik. Meistens.',
    eco:   'Eco-Runde? Ein Donut kostet trotzdem nix.',
    ace:   'Ace! Das gibt Streusel.',
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
  console.log('%c🍩 Hey, du schaust in die Konsole?', 'font: 700 16px sans-serif; color: #ff5fa8');
  console.log('Dann bist du hier richtig: https://discord.gg/GEPrazXBrJ\nPsst: Tipp mal "rushb", "eco" oder "ace" auf der Seite. Und das Logo mag es, angetippt zu werden.');
})();

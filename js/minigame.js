/* Clutch-Check: stop the crosshair inside the zone. Every hit = faster + smaller zone. */
(() => {
  'use strict';
  const root = document.getElementById('clutchGame');
  if (!root) return;
  const $ = s => root.querySelector(s);
  const bar = $('.cg-bar'), zone = $('.cg-zone'), cross = $('.cg-cross'), smoke = $('.cg-smoke'), flash = $('.cg-flash'), btn = $('.cg-btn');
  const levelEl = $('[data-cg="level"]'), bestEl = $('[data-cg="best"]'), triesEl = $('[data-cg="tries"]'), msg = $('.cg-msg');
  const form = $('.cg-submit'), nameInput = form.elements.name, submitBtn = form.querySelector('button');
  const boardWrap = $('.cg-board-wrap'), board = $('.cg-board'), modeName = $('[data-cg="mode-name"]');
  const API = root.dataset.api; // leer = Rangliste aus

  const MODES = {
    classic: { hint: 'Stopp das Fadenkreuz in der roten Zone.' },
    smoke:   { hint: 'Smoke liegt auf der Zone. Du siehst das Fadenkreuz nicht mehr, also Timing nach Gefühl.' },
    flash:   { hint: 'Achtung, Flashbangs! Nicht wegdrehen, einfach treffen.' },
    wobble:  { hint: 'Die Zone wackelt hin und her. Viel Glück.' },
    donut:   { hint: 'Donut-Modus: schneller, und das Fadenkreuz ist ein Donut. Fragt nicht.', speed: 1.3 },
  };
  const lines = ['Clean.', 'Ace!', 'Wie ein Pro.', 'Donut-Reflexe.', 'Clutch Minister.'];
  const storeKey = m => m === 'classic' ? 'donuts-clutch-best' : 'donuts-clutch-best-' + m; // classic keeps the old key
  const load = m => { try { return Number(localStorage.getItem(storeKey(m))) || 1; } catch { return 1; } };

  let mode = 'classic', best = load(mode), tries = 0, level = 1, pos = 0, dir = 1, running = false, last = 0, nextFlash = 0;
  let runStart = 0, runMs = 0, runLevel = 0, runMode = mode;
  try { nameInput.value = localStorage.getItem('donuts-clutch-name') || ''; } catch {}

  function showBoard(list) {
    board.replaceChildren(...list.map(e => {
      const li = document.createElement('li');
      const n = document.createElement('span'), l = document.createElement('b');
      n.textContent = e.name; l.textContent = 'Lvl ' + e.level;
      li.append(n, l);
      return li;
    }));
    if (!list.length) { const li = document.createElement('li'); li.className = 'cg-empty'; li.textContent = 'Noch leer. Hol dir Platz 1!'; board.append(li); }
    boardWrap.hidden = false;
  }
  async function loadBoard() {
    if (!API) return;
    const m = mode;
    try {
      const res = await fetch(API + '/scores?mode=' + m);
      if (res.ok && m === mode) showBoard(await res.json());
    } catch {}
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = nameInput.value.trim();
    try { localStorage.setItem('donuts-clutch-name', name); } catch {}
    submitBtn.disabled = true;
    try {
      const res = await fetch(API + '/scores', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: runMode, name, level: runLevel, ms: runMs }),
      });
      const data = await res.json();
      if (!res.ok) { msg.textContent = data.error || 'Eintragen hat nicht geklappt.'; return; }
      form.hidden = true;
      msg.textContent = 'Eingetragen! Mal sehen, wer dich schlägt.';
      if (runMode === mode) showBoard(data);
    } catch {
      msg.textContent = 'Server nicht erreichbar, versuch es gleich nochmal.';
    } finally { submitBtn.disabled = false; }
  });
  const z = { base: 0, from: 0, to: 0 };

  const speed = () => (0.45 + level * 0.12) * (MODES[mode].speed || 1); // bar widths per second
  const width = () => Math.max(0.04, 0.22 - level * 0.015);             // zone size, floor at 4 %
  const pct = (el, from, w) => { el.style.left = from * 100 + '%'; el.style.width = w * 100 + '%'; };

  function setZone(from) {
    const w = width();
    z.from = Math.min(Math.max(from, 0), 1 - w); z.to = z.from + w;
    pct(zone, z.from, w);
  }
  function placeZone() {
    z.base = Math.random() * (1 - width());
    setZone(z.base);
    if (mode === 'smoke') { // cover the zone plus a margin, so the crosshair vanishes right where it counts
      const from = Math.max(0, z.from - 0.1), to = Math.min(1, z.to + 0.1);
      pct(smoke, from, to - from);
    }
  }
  function render() {
    levelEl.textContent = level; bestEl.textContent = best; triesEl.textContent = tries;
  }
  function frame(t) {
    if (!running) return;
    pos += dir * speed() * (t - last) / 1000; last = t;
    if (pos > 1) { pos = 1; dir = -1; } else if (pos < 0) { pos = 0; dir = 1; }
    cross.style.left = pos * 100 + '%';
    if (mode === 'wobble') setZone(z.base + Math.sin(t / 450) * (0.08 + level * 0.01));
    if (mode === 'flash' && t > nextFlash) {
      flash.animate([{ opacity: 0.95 }, { opacity: 0 }], { duration: 900, easing: 'ease-out' });
      nextFlash = t + 1200 + Math.random() * 2000;
    }
    requestAnimationFrame(frame);
  }
  function start() {
    level = 1; tries++; pos = 0; dir = 1; running = true; form.hidden = true;
    placeZone(); render();
    root.classList.remove('is-hit', 'is-miss');
    msg.textContent = MODES[mode].hint + ' Stoppen mit Klick, Tippen oder Leertaste.';
    btn.textContent = 'STOP';
    last = runStart = performance.now(); nextFlash = last + 1500;
    requestAnimationFrame(frame);
  }
  function stop(text, label) {
    running = false;
    msg.textContent = text;
    btn.textContent = label;
  }
  function shoot() {
    if (!running) return start();
    const hit = pos >= z.from && pos <= z.to;
    root.classList.remove('is-hit', 'is-miss');
    void root.offsetWidth; // restart the hit/miss flash even on back-to-back hits
    root.classList.add(hit ? 'is-hit' : 'is-miss');
    if (hit) {
      level++;
      if (level > best) { best = level; try { localStorage.setItem(storeKey(mode), best); } catch {} }
      msg.textContent = lines[Math.floor(Math.random() * lines.length)] + ' Weiter mit Level ' + level + '.';
      placeZone();
    } else {
      stop('Daneben. Bis Level ' + level + ' geschafft. Nochmal?', 'NOCHMAL');
      runMs = Math.round(performance.now() - runStart); runLevel = level; runMode = mode;
      if (API && level >= 2) form.hidden = false;
    }
    render();
  }

  root.querySelectorAll('input[name="cg-mode"]').forEach(input => input.addEventListener('change', () => {
    mode = input.value; best = load(mode); level = 1; form.hidden = true;
    modeName.textContent = input.nextElementSibling.textContent;
    loadBoard();
    root.dataset.mode = mode;
    root.classList.remove('is-hit', 'is-miss');
    placeZone(); render();
    stop(MODES[mode].hint + ' Start drücken.', 'START');
  }));
  btn.addEventListener('click', shoot);
  bar.addEventListener('pointerdown', shoot);
  document.addEventListener('keydown', e => {
    if (e.code !== 'Space' || !running || e.target === btn) return; // focused button already fires click
    const r = root.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return; // only while the game is on screen
    e.preventDefault(); shoot();
  });
  root.dataset.mode = mode;
  render();
  loadBoard();
})();

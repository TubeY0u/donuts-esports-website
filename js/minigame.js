/* Clutch-Check: stop the crosshair inside the zone. Every hit = faster + smaller zone. */
(() => {
  'use strict';
  const root = document.getElementById('clutchGame');
  if (!root) return;
  const $ = s => root.querySelector(s);
  const bar = $('.cg-bar'), zone = $('.cg-zone'), cross = $('.cg-cross'), btn = $('.cg-btn');
  const levelEl = $('[data-cg="level"]'), bestEl = $('[data-cg="best"]'), triesEl = $('[data-cg="tries"]'), msg = $('.cg-msg');
  const KEY = 'donuts-clutch-best';
  let best = 1, tries = 0, level = 1, pos = 0, dir = 1, running = false, last = 0, z = { from: 0, to: 0 };
  try { best = Number(localStorage.getItem(KEY)) || 1; } catch {}

  const speed = () => 0.45 + level * 0.12;                 // bar widths per second
  const width = () => Math.max(0.04, 0.22 - level * 0.015); // zone size, floor at 4 %
  const lines = ['Clean.', 'Ace!', 'Wie ein Pro.', 'Donut-Reflexe.', 'Clutch Minister.'];

  function placeZone() {
    const w = width(), from = Math.random() * (1 - w);
    z = { from, to: from + w };
    zone.style.left = from * 100 + '%';
    zone.style.width = w * 100 + '%';
  }
  function render() {
    levelEl.textContent = level; bestEl.textContent = best; triesEl.textContent = tries;
  }
  function frame(t) {
    if (!running) return;
    pos += dir * speed() * (t - last) / 1000; last = t;
    if (pos > 1) { pos = 1; dir = -1; } else if (pos < 0) { pos = 0; dir = 1; }
    cross.style.left = pos * 100 + '%';
    requestAnimationFrame(frame);
  }
  function start() {
    level = 1; tries++; pos = 0; dir = 1; running = true;
    placeZone(); render();
    root.classList.remove('is-hit', 'is-miss');
    msg.textContent = 'Stoppen mit Klick, Tippen oder Leertaste.';
    btn.textContent = 'STOP';
    last = performance.now(); requestAnimationFrame(frame);
  }
  function shoot() {
    if (!running) return start();
    const hit = pos >= z.from && pos <= z.to;
    root.classList.toggle('is-hit', hit); root.classList.toggle('is-miss', !hit);
    if (hit) {
      level++;
      if (level > best) { best = level; try { localStorage.setItem(KEY, best); } catch {} }
      msg.textContent = lines[Math.floor(Math.random() * lines.length)] + ' Weiter mit Level ' + level + '.';
      placeZone(); render();
    } else {
      running = false;
      msg.textContent = 'Daneben. Bis Level ' + level + ' geschafft. Nochmal?';
      btn.textContent = 'NOCHMAL';
      render();
    }
  }

  btn.addEventListener('click', shoot);
  bar.addEventListener('pointerdown', shoot);
  document.addEventListener('keydown', e => {
    if (e.code !== 'Space' || !running || e.target === btn) return; // focused button already fires click
    const r = root.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return; // only while the game is on screen
    e.preventDefault(); shoot();
  });
  render();
})();

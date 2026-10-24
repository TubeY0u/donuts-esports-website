/* Läuft im <head>, damit die helle Variante ohne Aufblitzen geladen wird
   und der Donut-Zoom im Hero sein Layout hat, bevor gemalt wird. */
try { if (localStorage.getItem('donuts-theme') === 'light') document.documentElement.dataset.theme = 'light'; } catch (e) {}
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('zoom');

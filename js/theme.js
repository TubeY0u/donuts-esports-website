/* Läuft im <head>, damit die helle Variante ohne Aufblitzen geladen wird. */
try { if (localStorage.getItem('donuts-theme') === 'light') document.documentElement.dataset.theme = 'light'; } catch (e) {}

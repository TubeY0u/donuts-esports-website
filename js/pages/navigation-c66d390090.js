// Aktiven Menüpunkt markieren, /roster/main/ zählt zu /roster/
(function(){var p=location.pathname;document.querySelectorAll('.nav-links a').forEach(function(a){var h=a.getAttribute('href')||'';if(h!=='/'&&p.indexOf(h)===0)a.classList.add('active');});})();

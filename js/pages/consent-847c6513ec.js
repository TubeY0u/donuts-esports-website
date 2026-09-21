
(function() {
  var consent = localStorage.getItem('cookie-consent');
  var banner  = document.getElementById('cookieBanner');

  function loadFonts() {
    var link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';
    document.head.appendChild(link);
  }

  if (consent === 'accepted') {
    loadFonts();
    if (banner) banner.style.display = 'none';
  } else if (consent === 'declined') {
    if (banner) banner.style.display = 'none';
  } else {
    if (banner) {
      banner.classList.add('is-visible');
      document.getElementById('cookieAccept').addEventListener('click', function() {
        localStorage.setItem('cookie-consent', 'accepted');
        banner.classList.remove('is-visible');
        setTimeout(function() { banner.style.display = 'none'; }, 400);
        loadFonts();
      });
      document.getElementById('cookieDecline').addEventListener('click', function() {
        localStorage.setItem('cookie-consent', 'declined');
        banner.classList.remove('is-visible');
        setTimeout(function() { banner.style.display = 'none'; }, 400);
      });
    }
  }
})();

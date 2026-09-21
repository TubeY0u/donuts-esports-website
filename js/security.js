/* Shared output rules. HTML escaping and URL validation are separate checks. */
(() => {
  'use strict';
  const escapeHtml = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  function safeUrl(value) {
    if (typeof value !== 'string' || !value.trim() || /[\u0000-\u0020\u007f]/.test(value)) return '#';
    try {
      const url = new URL(value, window.location.origin);
      if (url.username || url.password) return '#';
      if (url.protocol !== 'https:' && !(url.origin === window.location.origin && value.startsWith('/') && !value.startsWith('//'))) return '#';
      return url.href;
    } catch { return '#'; }
  }
  Object.defineProperty(window, 'DonutsSecurity', { value: Object.freeze({ escapeHtml, safeUrl }) });
  document.addEventListener('error', event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;
    if (image.hasAttribute('data-gallery-fallback')) {
      image.style.display = 'none';
      if (image.nextElementSibling) image.nextElementSibling.style.display = 'flex';
    } else if (image.hasAttribute('data-remove-on-error')) image.remove();
  }, true);
})();

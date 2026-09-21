
(function(){
  var frame = document.getElementById('heroVideoFrame');
  var ytId = frame && frame.dataset.ytId;
  if (ytId && /^[A-Za-z0-9_-]{11}$/.test(ytId.trim())) {
    var ph = document.getElementById('heroVideoPlaceholder');
    if (ph) ph.remove();
    var iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + ytId.trim() + '?rel=0&modestbranding=1&autoplay=1&mute=1';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    iframe.setAttribute('allowfullscreen', '');
    iframe.className = 'hvf-iframe';
    frame.insertBefore(iframe, frame.querySelector('.hpf-label'));
  }
})();

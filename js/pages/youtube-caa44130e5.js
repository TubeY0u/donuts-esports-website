
(async function loadLatestYouTubeVideo() {
  // ── Trage hier deine YouTube-Kanal-ID ein (UC...) ──────────────────────────
  // Kanal-ID findest du unter: youtube.com/@DieDonuts_eSports → Über → Teilen → Kanal-ID kopieren
  const CHANNEL_ID = 'UCTbXxRQ2Fx0pjLD4Mj-2fCg';
  // ───────────────────────────────────────────────────────────────────────────
  if (!CHANNEL_ID) return;
  try {
    const res = await fetch('/data/youtube.json', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return;
    const video = await res.json();
    const videoId = video.videoId;
    const title = String(video.title || '');
    const pubDate = video.published ? new Date(video.published).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || '')) return;
    const frame = document.getElementById('ytFrame');
    frame.src = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
    frame.style.display = 'block';
    document.getElementById('ytPlaceholder').style.display = 'none';
    document.getElementById('ytTitle').textContent = title;
    document.getElementById('ytDate').textContent  = pubDate;
    document.getElementById('ytMeta').style.display = 'flex';
  } catch (e) {
    console.warn('[DieDonuts] YouTube feed:', e);
  }
})();

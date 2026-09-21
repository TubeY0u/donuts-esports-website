import { writeFileSync } from 'node:fs';
try {
  const res = await fetch('https://www.youtube.com/feeds/videos.xml?channel_id=UCTbXxRQ2Fx0pjLD4Mj-2fCg', {
    redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error('Feed unavailable');
  const xml = await res.text();
  const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/)?.[1];
  const videoId = entry?.match(/<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/)?.[1];
  if (!videoId) throw new Error('Invalid video');
  const decode = value => value.replace(/&(?:amp|lt|gt|quot|apos);/g, s => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[s]));
  const title = decode(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
  const date = new Date(entry.match(/<published>([^<]+)<\/published>/)?.[1]);
  const published = Number.isFinite(date.getTime()) ? date.toISOString() : null;
  writeFileSync(new URL('../data/youtube.json', import.meta.url), JSON.stringify({ videoId, title, published }, null, 2) + '\n');
  console.log('YouTube metadata updated.');
} catch {
  console.error('YouTube update failed; previous metadata retained.');
  process.exitCode = 1;
}

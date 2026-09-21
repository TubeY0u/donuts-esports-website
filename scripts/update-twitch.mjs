import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const CHANNELS = ['diedonuts_esports', 'halfy_cs', 'tube_y0u', 'its_kriistiin', 'derohnedaumen', 'sirokkoko'];
export async function collectTwitch({ clientId, clientSecret, request = fetch, now = () => new Date() }) {
  if (!clientId || !clientSecret) throw new Error('Twitch credentials missing');
  let token;
  try {
    const auth = await request('https://id.twitch.tv/oauth2/token', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
    });
    if (!auth.ok) throw new Error(`Twitch authentication failed (${auth.status})`);
    token = (await auth.json()).access_token;
    if (typeof token !== 'string' || !token) throw new Error('Twitch access token missing');
    if (process.env.GITHUB_ACTIONS === 'true') console.log(`::add-mask::${token}`);
    const query = new URLSearchParams(CHANNELS.map(channel => ['user_login', channel]));
    const res = await request(`https://api.twitch.tv/helix/streams?${query}`, {
      headers: { 'Client-ID': clientId, Authorization: `Bearer ${token}` },
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Twitch status failed (${res.status})`);
    const data = await res.json();
    if (!Array.isArray(data.data)) throw new Error('Invalid Twitch status response');
    return {
      updatedAt: now().toISOString(),
      data: data.data.filter(s => CHANNELS.includes(s.user_login) && Number.isSafeInteger(s.viewer_count) && s.viewer_count >= 0)
        .map(s => ({ user_login: s.user_login, viewer_count: s.viewer_count })),
    };
  } finally {
    // Never persist the token. Revoke it even when the API request fails.
    if (token) {
      const revoked = await request('https://id.twitch.tv/oauth2/revoke', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        body: new URLSearchParams({ client_id: clientId, token }),
      });
      if (!revoked.ok) throw new Error(`Twitch token revocation failed (${revoked.status})`);
    }
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const status = await collectTwitch({ clientId: process.env.TWITCH_CLIENT_ID, clientSecret: process.env.TWITCH_CLIENT_SECRET });
    const dir = new URL('../data/', import.meta.url);
    mkdirSync(dir, { recursive: true });
    writeFileSync(new URL('twitch-status.json', dir), JSON.stringify(status, null, 2) + '\n');
    console.log('Public Twitch status updated.');
  } catch {
    console.error('Twitch update failed; previous public status retained.');
    process.exitCode = 1;
  }
}

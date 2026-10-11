import {hasTurn,parseIceServers} from '../client/src/services/ice';

export type RelayEnv = {TURN_KEY_ID?: string; TURN_KEY_API_TOKEN?: string; RELAY_ACCESS_CODE?: string};
const TTL_SECONDS = 20 * 60;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
}

/** Runs on the server; provider tokens never enter a client bundle or response. */
export async function relayCredentials(request: Request, env: RelayEnv, providerFetch: typeof fetch = fetch) {
  // Public availability only: no credentials, provider calls or side effects.
  // Direct-only sites must not depend on a POST through the preview proxy.
  if (request.method === 'GET') return json({enabled: Boolean(env.TURN_KEY_ID || env.TURN_KEY_API_TOKEN)});
  if (request.method !== 'POST') return json({error: 'Method not allowed.'}, 405);
  const origin = request.headers.get('origin');
  // A matching Origin is authoritative. HTTPS forwarding/authentication proxies
  // can preserve cross-site fetch metadata even after the request reaches its
  // own origin. When Origin is absent, still reject cross-site requests.
  if (origin ? origin !== new URL(request.url).origin : request.headers.get('sec-fetch-site') === 'cross-site') return json({error: 'Forbidden.', code: 'ORIGIN_NOT_ALLOWED'}, 403);
  if (!env.TURN_KEY_ID && !env.TURN_KEY_API_TOKEN) return json({enabled: false});
  if (!env.TURN_KEY_ID || !/^[a-zA-Z0-9_-]{1,128}$/.test(env.TURN_KEY_ID) || !env.TURN_KEY_API_TOKEN) return json({error: 'Relay is not configured.', code: 'RELAY_NOT_CONFIGURED'}, 503);
  // This private app issues credentials only to people given the owner's code.
  if (!env.RELAY_ACCESS_CODE) return json({error: 'Relay access is not configured.', code: 'RELAY_ACCESS_NOT_CONFIGURED'}, 503);
  if (request.headers.get('x-relay-access') !== env.RELAY_ACCESS_CODE) return json({error: 'Relay access code required.', code: 'RELAY_ACCESS_REQUIRED'}, 401);
  try {
    const result = await providerFetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: 'POST', headers: {'Authorization': `Bearer ${env.TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({ttl: TTL_SECONDS}), signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) return json({error: 'Relay service unavailable.'}, 503);
    const payload = await result.json() as {iceServers?: unknown};
    const iceServers = parseIceServers(payload.iceServers);
    if (!hasTurn(iceServers)) return json({error: 'Relay service unavailable.'}, 503);
    return json({enabled: true, iceServers});
  } catch {
    return json({error: 'Relay service unavailable.'}, 503);
  }
}

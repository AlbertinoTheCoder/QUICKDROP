/** Public, short-lived relay credentials. Never accepts a provider API key. */
export function parseIceServers(value: unknown): RTCIceServer[] {
  if (!Array.isArray(value) || !value.length || value.length > 8) throw new Error('Invalid relay configuration.');
  return value.map(server => {
    if (!server || typeof server !== 'object') throw new Error('Invalid relay configuration.');
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    if (!urls.length || urls.length > 16 || urls.some((url: unknown) => typeof url !== 'string' || url.length > 256 || !/^(?:stun|stuns|turn|turns):[a-z0-9.-]+(?::\d{1,5})?(?:\?transport=(?:udp|tcp))?$/i.test(url as string))) throw new Error('Invalid relay configuration.');
    const usable = urls.filter((url: string) => !/:53(?:\?|$)/.test(url));
    if (!usable.length) throw new Error('Invalid relay configuration.');
    if (usable.some((url: string) => /^turns?:/i.test(url))) {
      if (typeof server.username !== 'string' || !server.username || server.username.length > 1024 || typeof server.credential !== 'string' || !server.credential || server.credential.length > 1024) throw new Error('Invalid relay configuration.');
      return {urls: usable, username: server.username, credential: server.credential};
    }
    return {urls: usable};
  });
}

export function hasTurn(servers: RTCIceServer[]) {
  return servers.some(server => (Array.isArray(server.urls) ? server.urls : [server.urls]).some(url => /^turns?:/i.test(url)));
}

export async function loadIceServers(directServers: RTCIceServer[], signal?: AbortSignal, accessCode = ''): Promise<RTCIceServer[]> {
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000);
  async function request(method: 'GET' | 'POST') {
    let response: Response;
    try {
      response = await fetch('/api/ice', {method, credentials: 'same-origin', cache: 'no-store', signal: requestSignal,
        ...(method === 'POST' ? {headers: {'Content-Type': 'application/json', ...(accessCode ? {'X-Relay-Access': accessCode} : {})}, body: '{}'} : {}),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error('Connection setup is unavailable. Please try again.');
    }
    // A static-only deployment has no credential endpoint; retain direct pairing.
    if (method === 'GET' && ([404,405].includes(response.status) || response.ok && !response.headers.get('content-type')?.includes('application/json'))) return {enabled: false};
    if (!response.ok) {
      const raw = await response.text();
      let code: unknown;
      try {code = JSON.parse(raw).code;} catch {}
      if (response.status === 401) {
        if (code === 'RELAY_ACCESS_REQUIRED' || raw.includes('Relay access code required.')) throw new Error('Enter the connection code in Settings, then try again.');
        throw new Error('The preview link requires GitHub sign-in. Open the link and sign in, then try again.');
      }
      if (response.status === 403) {
        if (code === 'ORIGIN_NOT_ALLOWED') throw new Error('The app rejected the connection origin (ORIGIN). Open QuickDrop directly from its Ports link.');
        if (raw.includes('Blocked request.') && raw.includes('not allowed')) throw new Error('The preview server rejected this hostname (HOST). Open QuickDrop from the Ports tab.');
        throw new Error('Codespaces blocked the connection request (PROXY 403). Open the preview link directly and check GitHub access.');
      }
      if (code === 'RELAY_NOT_CONFIGURED') throw new Error('The relay is not configured. The site owner must add the TURN service keys.');
      if (code === 'RELAY_ACCESS_NOT_CONFIGURED') throw new Error('The relay connection code is not configured. Contact the site owner.');
      throw new Error('Relay setup is unavailable. Please try again.');
    }
    try {return await response.json();} catch {throw new Error('Invalid relay configuration.');}
  }
  const availability = await request('GET');
  if (!availability || typeof availability !== 'object') throw new Error('Invalid relay configuration.');
  if (availability.enabled === false) return directServers;
  if (availability.enabled !== true) throw new Error('Invalid relay configuration.');
  const body = await request('POST');
  if (!body || typeof body !== 'object') throw new Error('Invalid relay configuration.');
  if (body.enabled === false) return directServers;
  const servers = parseIceServers(body.iceServers);
  if (!hasTurn(servers)) throw new Error('Invalid relay configuration.');
  return [...directServers, ...servers];
}

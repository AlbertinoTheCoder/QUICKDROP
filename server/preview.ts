/** Allow only this Codespace's forwarded hostname for the configured port. */
export function codespacesHost(env: {CODESPACE_NAME?: string; GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN?: string}, port: number) {
  const name = env.CODESPACE_NAME;
  const domain = env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (!name || !domain || !/^[a-z0-9-]+$/i.test(name) || !/^[a-z0-9.-]+$/i.test(domain)) return undefined;
  return `${name}-${port}.${domain}`;
}

export function previewRequestUrl(headers: Headers, forwardedHost?: string, port?: number) {
  // Codespaces terminates HTTPS before forwarding to Vite's HTTP listener.
  // Accept the exact known external origin even if proxy headers were omitted.
  const externalOrigin = forwardedHost ? `https://${forwardedHost}` : undefined;
  if (externalOrigin && headers.get('origin') === externalOrigin) return `${externalOrigin}/api/ice`;
  // The Codespaces proxy can rewrite only Origin to loopback while retaining
  // the public Host and forwarded HTTPS protocol. Recognize the exact local
  // listener origin only for this Codespace and port.
  if (forwardedHost && port && headers.get('origin')) {
    try {
      const origin = new URL(headers.get('origin')!);
      const localHosts = ['localhost', '127.0.0.1', '[::1]'];
      const host = headers.get('host');
      if (!origin.username && !origin.password && ['http:', 'https:'].includes(origin.protocol)
        && localHosts.includes(origin.hostname) && origin.port === String(port)
        && (host === forwardedHost || localHosts.some(name => host === `${name}:${port}`))) return `${origin.origin}/api/ice`;
    } catch {}
  }
  const protocol = headers.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  return `${protocol}://${headers.get('host') || 'localhost'}/api/ice`;
}

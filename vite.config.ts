import {defineConfig,loadEnv,Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import {relayCredentials,RelayEnv} from './server/relay';
import {codespacesHost,previewRequestUrl} from './server/preview';

function relayPlugin(env: RelayEnv & Record<string,string>): Plugin {
  let forwardedHost: string | undefined;
  return {
    name: 'quickdrop-relay',
    configResolved(config) {
      forwardedHost = codespacesHost({CODESPACE_NAME:env.CODESPACE_NAME,GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}, config.server.port);
      if (forwardedHost && Array.isArray(config.server.allowedHosts)) config.server.allowedHosts.push(forwardedHost);
    },
    configureServer(server) {
      server.middlewares.use('/api/ice', async (req, res) => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        try {
          const request = new Request(previewRequestUrl(headers, forwardedHost, server.config.server.port), {method: req.method, headers});
          const response = await relayCredentials(request, env);
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(await response.text());
        } catch {
          res.writeHead(503, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
          res.end(JSON.stringify({error: 'Relay service unavailable.'}));
        }
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {root:'client',envDir:'..',plugins:[react(),tailwind(),relayPlugin(env)],server:{host:'0.0.0.0'},build:{outDir:'../dist',emptyOutDir:true}};
});

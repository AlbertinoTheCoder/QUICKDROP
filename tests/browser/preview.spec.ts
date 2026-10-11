import {test,expect} from '@playwright/test';

test('Codespaces forwarded requests pass through Vite and the credential endpoint',async({request},info)=>{
 const name=process.env.CODESPACE_NAME,domain=process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
 test.skip(!name||!domain,'This check requires a Codespaces forwarding hostname.');
 const port=new URL(info.project.use.baseURL!).port;
 const host=`${name}-${port}.${domain}`;
 const page=await request.get('/',{headers:{Host:host}});expect(page.status()).toBe(200);expect(page.headers()['content-type']).toContain('text/html');
 for(const internalHost of [host,`localhost:${port}`]){
  const response=await request.post('/api/ice',{headers:{Host:internalHost,Origin:`https://${host}`,'Sec-Fetch-Site':'cross-site'},data:{}});
  expect(response.status()).toBe(200);expect(await response.json()).toEqual({enabled:false});
 }
 const rewritten=await request.post('/api/ice',{headers:{Host:host,Origin:`http://localhost:${port}`,'X-Forwarded-Proto':'https','Sec-Fetch-Site':'same-origin'},data:{}});
 expect(rewritten.status()).toBe(200);expect(await rewritten.json()).toEqual({enabled:false});
 const untrusted=await request.post('/api/ice',{headers:{Host:host,Origin:'https://another.example','Sec-Fetch-Site':'same-origin'},data:{}});
 expect(untrusted.status()).toBe(403);
});

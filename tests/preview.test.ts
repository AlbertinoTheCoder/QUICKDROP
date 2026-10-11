import {test} from 'node:test';
import assert from 'node:assert/strict';
import {codespacesHost,previewRequestUrl} from '../server/preview';
import {relayCredentials} from '../server/relay';

test('Codespaces HTTPS origin works despite an HTTP listener and rewritten Host header',async()=>{
 const host=codespacesHost({CODESPACE_NAME:'my-codespace',GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:'app.github.dev'},5174)!;
 assert.equal(host,'my-codespace-5174.app.github.dev');
 for(const incomingHost of [host,'localhost:5174','127.0.0.1:5174'])for(const fetchSite of ['same-origin','cross-site']){
  const headers=new Headers({host:incomingHost,origin:`https://${host}`,'sec-fetch-site':fetchSite});
  const request=new Request(previewRequestUrl(headers,host),{method:'POST',headers});
  const response=await relayCredentials(request,{});assert.equal(response.status,200);assert.deepEqual(await response.json(),{enabled:false});
 }
});

test('another Codespace or unrelated website cannot bypass the same-origin check',async()=>{
 const host='my-codespace-5174.app.github.dev';
 for(const origin of ['https://other-codespace-5174.app.github.dev','https://my-codespace-5175.app.github.dev','https://untrusted.example']){
  const headers=new Headers({host:'localhost:5174',origin,'x-forwarded-host':host});
  assert.equal((await relayCredentials(new Request(previewRequestUrl(headers,host),{method:'POST',headers}),{})).status,403);
 }
 assert.equal(codespacesHost({},5174),undefined);
});

test('a missing Origin does not authorize cross-site relay access',async()=>{
 const headers=new Headers({host:'localhost:5174','sec-fetch-site':'cross-site'});
 const response=await relayCredentials(new Request(previewRequestUrl(headers),{method:'POST',headers}),{});
 assert.equal(response.status,403);
});

test('Codespaces rewritten loopback Origin remains valid with an external Host',async()=>{
 const host='my-codespace-5174.app.github.dev';
 for(const origin of ['http://localhost:5174','https://localhost:5174','http://127.0.0.1:5174']){
  const headers=new Headers({host,origin,'x-forwarded-proto':'https','sec-fetch-site':'same-origin'});
  const response=await relayCredentials(new Request(previewRequestUrl(headers,host,5174),{method:'POST',headers}),{});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{enabled:false});
 }
 for(const origin of ['http://localhost:5175','https://attacker.example','http://localhost:5174@attacker.example']){
  const headers=new Headers({host,origin,'x-forwarded-proto':'https'});
  assert.equal((await relayCredentials(new Request(previewRequestUrl(headers,host,5174),{method:'POST',headers}),{})).status,403);
 }
});

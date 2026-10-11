import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relayCredentials} from '../server/relay';
import {hasTurn,loadIceServers,parseIceServers} from '../client/src/services/ice';

const env = {TURN_KEY_ID: 'test-key', TURN_KEY_API_TOKEN: 'provider-secret', RELAY_ACCESS_CODE: 'friend-code'};
const servers = [{urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp', 'turn:turn.cloudflare.com:53'], username: 'temporary-user', credential: 'temporary-password'}];
const request = (headers: Record<string,string> = {}) => new Request('https://quickdrop.example/api/ice', {method: 'POST', headers: {origin: 'https://quickdrop.example', 'x-relay-access': 'friend-code', ...headers}});

test('credential endpoint is disabled without a service and protects configured relay access', async () => {
  let called = false;
  const provider = (async () => {called = true; throw new Error('Unexpected call.');}) as typeof fetch;
  assert.deepEqual(await (await relayCredentials(request(), {}, provider)).json(), {enabled: false});
  assert.equal((await relayCredentials(request({origin:'https://other.example'}),env,provider)).status,403);
  assert.equal((await relayCredentials(request({'x-relay-access':'wrong'}),env,provider)).status,401);
  assert.equal((await relayCredentials(request(), {...env,RELAY_ACCESS_CODE:''},provider)).status,503);
  assert.deepEqual(await (await relayCredentials(new Request('https://quickdrop.example/api/ice'), env,provider)).json(),{enabled:true});
  assert.equal((await relayCredentials(new Request('https://quickdrop.example/api/ice',{method:'DELETE'}), env,provider)).status,405);
  assert.equal(called,false);
});

test('relay issues short-lived credentials without leaking provider keys or browser-blocked port 53', async () => {
  const provider = (async (input, options) => {
    assert.equal(input, 'https://rtc.live.cloudflare.com/v1/turn/keys/test-key/credentials/generate-ice-servers');
    assert.equal(new Headers(options?.headers).get('authorization'),'Bearer provider-secret');
    assert.deepEqual(JSON.parse(options?.body as string),{ttl:1200});
    return Response.json({iceServers: servers, extraSecret:'not-for-the-client'}, {status:201});
  }) as typeof fetch;
  const response = await relayCredentials(request(), env, provider);
  assert.equal(response.headers.get('cache-control'),'no-store');
  const raw = await response.text();
  assert.ok(raw.includes('temporary-password'));
  for (const secret of ['provider-secret','test-key','friend-code','not-for-the-client',':53']) assert.ok(!raw.includes(secret));
  assert.equal(hasTurn(JSON.parse(raw).iceServers),true);
});

test('provider failures and invalid credentials produce generic errors with no secret output', async () => {
  for(const provider of [async()=>Response.json({error:'provider-secret'},{status:401}),async()=>{throw new Error('provider-secret');},async()=>Response.json({iceServers:[{urls:'turn:relay.example',username:'only-user'}]})]){
    const response=await relayCredentials(request(),env,provider as typeof fetch);
    assert.equal(response.status,503);assert.ok(!(await response.text()).includes('provider-secret'));
  }
  assert.throws(()=>parseIceServers([{urls:'https://relay.example',username:'user',credential:'secret'}]),/Invalid/);
  assert.throws(()=>parseIceServers([{urls:'turn:relay.example'}]),/Invalid/);
});

test('browser loads credentials on demand and retains direct mode only when no relay endpoint is configured', async () => {
  const original=globalThis.fetch;
  const direct=[{urls:'stun:stun.example:3478'}];
  try {
    globalThis.fetch=(async (_url,options)=>{if(options?.method==='GET'){assert.equal(new Headers(options.headers).get('x-relay-access'),null);return Response.json({enabled:true});}assert.equal(options?.method,'POST');assert.equal(new Headers(options?.headers).get('x-relay-access'),'friend-code');return Response.json({enabled:true,iceServers:servers});}) as typeof fetch;
    const loaded=await loadIceServers(direct,undefined,'friend-code');assert.equal(hasTurn(loaded),true);assert.equal(loaded[0],direct[0]);
    for(const response of [Response.json({enabled:false}),new Response('',{status:404}),new Response('<html></html>',{headers:{'content-type':'text/html'}})]){
      globalThis.fetch=(async()=>response) as typeof fetch;assert.equal(await loadIceServers(direct),direct);
    }
    globalThis.fetch=(async()=>new Response('',{status:503})) as typeof fetch;await assert.rejects(loadIceServers(direct),/unavailable/);
    globalThis.fetch=(async()=>Response.json({code:'RELAY_ACCESS_REQUIRED'},{status:401})) as typeof fetch;await assert.rejects(loadIceServers(direct),/connection code/);
    globalThis.fetch=(async()=>new Response('',{status:401,headers:{'www-authenticate':'tunnel'}})) as typeof fetch;await assert.rejects(loadIceServers(direct),/GitHub sign-in/);
    globalThis.fetch=(async()=>new Response('',{status:403})) as typeof fetch;await assert.rejects(loadIceServers(direct),/PROXY 403/);
    globalThis.fetch=(async()=>Response.json({code:'ORIGIN_NOT_ALLOWED'},{status:403})) as typeof fetch;await assert.rejects(loadIceServers(direct),/ORIGIN/);
    globalThis.fetch=(async()=>new Response('Blocked request. This host is not allowed.',{status:403})) as typeof fetch;await assert.rejects(loadIceServers(direct),/HOST/);
    globalThis.fetch=(async()=>Response.json({code:'RELAY_NOT_CONFIGURED'},{status:503})) as typeof fetch;await assert.rejects(loadIceServers(direct),/must add the TURN/);
    globalThis.fetch=(async()=>Response.json({code:'RELAY_ACCESS_NOT_CONFIGURED'},{status:503})) as typeof fetch;await assert.rejects(loadIceServers(direct),/connection code is not configured/);
  } finally {globalThis.fetch=original;}
});

test('an unconfigured relay skips POST entirely, even if the proxy rejects POST',async()=>{
 const original=globalThis.fetch;const methods:string[]=[];
 try{
  globalThis.fetch=(async(_url,options)=>{methods.push(options!.method!);return options?.method==='GET'?Response.json({enabled:false}):new Response('Blocked by proxy',{status:403});}) as typeof fetch;
  const direct=[{urls:'stun:stun.example:3478'}];assert.equal(await loadIceServers(direct),direct);assert.deepEqual(methods,['GET']);
 }finally{globalThis.fetch=original;}
});

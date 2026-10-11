import {test} from 'node:test';
import assert from 'node:assert/strict';
import {candidateCounts,connectionHint,emptyDiagnostics,failureGuidance} from '../client/src/services/diagnostics';
test('diagnostics count routes without exposing addresses or credentials',()=>{
 const sdp='v=0\r\na=ice-pwd:secret-password\r\na=candidate:1 1 udp 1 192.168.1.10 5000 typ host\r\na=candidate:2 1 udp 1 203.0.113.7 5001 typ srflx raddr 192.168.1.10 rport 5000\r\na=candidate:3 1 udp 1 device.local 5000 typ host\r\na=candidate:4 1 udp 1 203.0.113.8 5000 typ relay\r\n';
 assert.deepEqual(candidateCounts(sdp),{host:2,srflx:1,prflx:0,relay:1});
 const serialized=JSON.stringify(candidateCounts(sdp));for(const secret of ['192.168','203.0.113','secret-password','device.local'])assert.ok(!serialized.includes(secret));
 assert.deepEqual(candidateCounts(),{host:0,srflx:0,prflx:0,relay:0});
});
test('connection hints distinguish missing local routes, missing answer and missing STUN without claiming certainty',()=>{
 const d=emptyDiagnostics(true);assert.match(connectionHint(d),/No local/);d.local.host=1;assert.match(connectionHint(d),/No remote/);d.remote.host=1;assert.match(connectionHint(d),/does not prove/);d.local.srflx=1;assert.match(connectionHint(d),/NAT/);d.stunEnabled=false;d.local.srflx=0;assert.match(connectionHint(d),/No TURN/);
});

test('offer preparation failure shows its real cause, not missing remote routes',()=>{
 const d=emptyDiagnostics(true);d.local.host=1;
 assert.equal(failureGuidance('Pairing failed',d,'Network discovery timed out. Try again.'),'Network discovery timed out. Try again.');
 assert.ok(!failureGuidance('Pairing failed',d).includes('No remote'));
 assert.match(failureGuidance('Connection failed — this network may block direct transfers.',d),/No remote/);
 assert.match(failureGuidance('Session expired',d),/new session/);
});

test('relay diagnostics distinguish unavailable relay routes from failure after discovery',()=>{
 const d=emptyDiagnostics(true,true);d.local.host=1;d.remote.host=1;
 assert.match(connectionHint(d),/no local relay route/);assert.ok(!connectionHint(d).includes('No TURN'));
 d.local.relay=1;assert.match(connectionHint(d),/Relay routes were discovered/);
});

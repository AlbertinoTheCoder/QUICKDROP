/** Local troubleshooting metadata. Never contains SDP, addresses, tokens or content. */
export type CandidateCounts={host:number;srflx:number;prflx:number;relay:number};
export type NetworkDiagnostics={stunEnabled:boolean;turnEnabled:boolean;gathering:string;ice:string;connection:string;local:CandidateCounts;remote:CandidateCounts;stunErrorCodes:number[]};
export function candidateCounts(sdp=''):CandidateCounts{
 const counts:CandidateCounts={host:0,srflx:0,prflx:0,relay:0};
 for(const line of sdp.split(/\r?\n/)){
  if(!line.startsWith('a=candidate:'))continue;
  const type=line.match(/\styp\s+(host|srflx|prflx|relay)(?:\s|$)/)?.[1] as keyof CandidateCounts|undefined;
  if(type)counts[type]++;
 }
 return counts;
}
export function emptyDiagnostics(stunEnabled=false,turnEnabled=false):NetworkDiagnostics{return {stunEnabled,turnEnabled,gathering:'new',ice:'new',connection:'new',local:candidateCounts(),remote:candidateCounts(),stunErrorCodes:[]};}
export function connectionHint(d:NetworkDiagnostics){
 const total=(counts:CandidateCounts)=>Object.values(counts).reduce((sum,n)=>sum+n,0);
 if(!total(d.local))return 'No local network routes were discovered. Check the browser and network, then create a fresh offer.';
 if(!total(d.remote))return 'No remote network routes were loaded. Check that the complete offer and answer were exchanged.';
 if(d.turnEnabled){
  if(!d.local.relay)return 'The relay is configured, but no local relay route was discovered. The relay may be unreachable or its credentials may have expired. Start a new session.';
  return 'Relay routes were discovered, but the browsers did not connect. Keep both pages open, exchange a fresh offer and answer, and try again.';
 }
 if(d.stunEnabled&&!d.local.srflx)return 'No STUN-derived public address was discovered. STUN may be blocked or unavailable; this does not prove the cause. Try the same trusted Wi-Fi.';
 return 'Network addresses were discovered, but the browsers did not connect. NAT, firewall rules or browser suspension may be responsible. Try another network or the same trusted Wi-Fi. No TURN relay is configured.';
}
/** Missing remote candidates are normal while creating the first offer. */
export function failureGuidance(status:string,network:NetworkDiagnostics,pairingError=''){
 if(status==='Pairing failed')return pairingError||'The connection offer or answer could not be prepared. Start a new session and keep this page open during network discovery.';
 if(status.startsWith('Connection failed')||status.startsWith('Could not connect'))return connectionHint(network);
 return 'Start a new session to reconnect.';
}

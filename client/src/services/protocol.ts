export const MAX_BYTES=500*1024*1024;
export const MAX_FILES=20;
export const MAX_TEXT_BYTES=32*1024;
export const CHUNK_BYTES=16*1024;
export const SESSION_MS=10*60*1000;
export type Item={name:string;size:number;type:string};
export type Manifest={kind:'files';items:Item[]}|{kind:'text';text:string};
export type Control={type:'proposal';id:number;manifest:Manifest}|{type:'accept'|'reject'|'cancel'|'end'|'ack';id:number};
export function safeName(name:string){return name.replace(/\\/g,'/').split('/').pop()!.replace(/[\x00-\x1f\x7f<>:"|?*]/g,'_').slice(0,180)||'file';}
export function validateManifest(value:unknown):Manifest{
 const m=value as any;if(!m||typeof m!=='object')throw new Error('Invalid transfer details.');
 if(m.kind==='text'){if(typeof m.text!=='string'||!m.text.trim()||new TextEncoder().encode(m.text).length>MAX_TEXT_BYTES)throw new Error('Text must contain 1–32 KB of text.');return {kind:'text',text:m.text};}
 if(m.kind!=='files'||!Array.isArray(m.items)||!m.items.length||m.items.length>MAX_FILES)throw new Error('Choose between 1 and 20 files.');
 const items=m.items.map((f:any)=>{if(!f||typeof f.name!=='string'||f.name.length>180||!Number.isSafeInteger(f.size)||f.size<0||f.size>MAX_BYTES||typeof f.type!=='string'||f.type.length>100)throw new Error('Invalid file details.');return {name:safeName(f.name),size:f.size,type:f.type};});
 if(items.reduce((sum:number,f:Item)=>sum+f.size,0)>MAX_BYTES)throw new Error('Transfers are limited to 500 MB total.');return {kind:'files',items};
}
export function parseControl(raw:string):Control{if(raw.length>65536)throw new Error('Message is too large.');const c=JSON.parse(raw);if(!c||!Number.isSafeInteger(c.id)||c.id<1||c.id>0xffffffff)throw new Error('Invalid transfer identifier.');if(c.type==='proposal')return {type:'proposal',id:c.id,manifest:validateManifest(c.manifest)};if(!['accept','reject','cancel','end','ack'].includes(c.type))throw new Error('Unknown message.');return {type:c.type,id:c.id};}
export function encodeChunk(id:number,index:number,offset:number,bytes:ArrayBuffer){const packet=new ArrayBuffer(16+bytes.byteLength);const view=new DataView(packet);view.setUint32(0,id);view.setUint32(4,index);view.setUint32(8,offset);view.setUint32(12,bytes.byteLength);new Uint8Array(packet,16).set(new Uint8Array(bytes));return packet;}
export function decodeChunk(packet:ArrayBuffer){if(packet.byteLength<16||packet.byteLength>CHUNK_BYTES+16)throw new Error('Invalid chunk size.');const v=new DataView(packet);if(v.getUint32(12)!==packet.byteLength-16||packet.byteLength===16)throw new Error('Invalid chunk length.');return {id:v.getUint32(0),index:v.getUint32(4),offset:v.getUint32(8),data:packet.slice(16)};}
export type Pairing={v:1;sid:string;expires:number;type:'offer'|'answer';sdp:string};
export function exportPairing(value:Pairing){return 'QD1.'+btoa(JSON.stringify(value));}
export function parsePairing(raw:string,expected:'offer'|'answer',now=Date.now()):Pairing{if(raw.trim().length>100000)throw new Error('Pairing data is too large.');let p:any;try{if(!raw.trim().startsWith('QD1.'))throw new Error();p=JSON.parse(atob(raw.trim().slice(4)));}catch{throw new Error('Invalid pairing data. Copy the complete QuickDrop pairing text.');}if(p?.v!==1||p.type!==expected||typeof p.sid!=='string'||!/^[-a-f0-9]{36}$/.test(p.sid)||typeof p.sdp!=='string'||p.sdp.length>65536||!p.sdp.startsWith('v=0')||!p.sdp.includes('m=application')||!Number.isSafeInteger(p.expires)||p.expires>now+SESSION_MS+5000)throw new Error(`Expected a valid ${expected}.`);if(p.expires<=now)throw new Error('This browser session has expired. Create a new offer.');return p;}

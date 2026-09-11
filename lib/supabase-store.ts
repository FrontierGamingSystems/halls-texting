import {env} from 'cloudflare:workers';
import crypto from 'node:crypto';
import directory from './directory.json';
import type {Hall,Message,Snapshot} from './types';
import {messageKind} from './message-kind';
import {normalizeMessage} from './store';
import {identify,actionStatus,attributionVersion,linksIn} from './attribution';
import {resolveLink,type LinkCache} from './resolve-links';
const halls=directory.halls as Hall[];
const seedVersion=crypto.createHash('sha256').update(JSON.stringify(halls)).digest('hex');
function setting(k:string){return (env as unknown as Record<string,string>)[k]||process.env[k];}
export function configured(){return !!setting('SUPABASE_URL')&&!!setting('SUPABASE_SERVICE_ROLE_KEY');}
async function api<T>(path:string,body?:unknown,method?:string):Promise<T>{
 const url=setting('SUPABASE_URL'),key=setting('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)throw Error('Supabase is not configured.');
 const r=await fetch(url.replace(/\/$/,'')+'/rest/v1/'+path,{method:method||(body?'POST':'GET'),headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error('Supabase request failed ('+r.status+').');
 return r.json() as Promise<T>;
}
async function state(){const rows=await api<{key:string;value:string}[]>('bingo_state?select=key,value');return Object.fromEntries(rows.map(r=>[r.key,r.value]));}
async function ingest(payload:unknown){return api<number>('rpc/bingo_ingest',{payload});}
const cache:LinkCache={
 async get(url){const rows=await api<{hall_ids:string[];evidence:string;checked_at:string;final_url:string}[]>('bingo_link_mappings?url=eq.'+encodeURIComponent(url)+'&select=*');return rows[0]?{...rows[0],hall_ids:JSON.stringify(rows[0].hall_ids)}:null;},
 async set(row){await api('bingo_link_mappings?on_conflict=url',{...row,hall_ids:JSON.parse(row.hall_ids)});}
};
async function associate(m:Message){let a=identify(m,halls);if(!a.hallIds.length){const extra=[];for(const u of linksIn(m.body).slice(0,4))extra.push(await resolveLink(u,halls,cache));a=identify(m,halls,extra);}return {...m,...a,kind:messageKind(m.body),hallId:a.hallIds.length===1?a.hallIds[0]:null,status:a.hallIds.length>1?'shared_list':a.hallIds.length?'classified':'needs_review',candidates:JSON.stringify(a.hallIds),actionStatus:actionStatus(m,halls,a)};}
async function prepare(){
 const saved=await state();
 if(saved.directory_version!==seedVersion)await ingest({halls,state:{directory_version:seedVersion}});
 if(saved.attribution_version!==attributionVersion){
  for(let offset=0;;offset+=500){const rows=await api<{record:Message}[]>('bingo_messages?select=record&order=id&limit=500&offset='+offset);if(!rows.length)break;const messages=[];for(const r of rows)messages.push(await associate(r.record));await ingest({messages});}
  await ingest({state:{attribution_version:attributionVersion}});
 }
 return saved;
}
export async function snapshot(day:string):Promise<Snapshot>{await prepare();const [data,s]=await Promise.all([api<Omit<Snapshot,'lastSync'|'connected'|'cityCount'>>('rpc/bingo_snapshot',{requested_day:day}),state()]);return {...data,lastSync:s.last_sync||null,connected:!!setting('TD_API_KEY'),cityCount:directory.cityCoverage.length};}
export async function history(hallId:string,offset=0){await prepare();return api<{messages:Message[];hasMore:boolean}>('rpc/bingo_history',{p_hall:hallId,p_offset:offset});}
export async function sync(){
 const saved=await prepare(),key=setting('TD_API_KEY'),number=setting('TD_NUMBER');
 if(!key||!number)throw Error('SMS connection is not configured.');
 if(saved.last_sync&&Date.now()-Date.parse(saved.last_sync)<55000)return {added:0,lastSync:saved.last_sync};
 const end=Math.floor(Date.now()/1000),start=saved.last_sync?Math.max(1789110000,Math.floor(Date.parse(saved.last_sync)/1000)-86400):1789110000;
 let added=0,previous='';
 for(let page=1;page<=100;page++){
  const r=await fetch('https://www.tossabledigits.com/apihttp.php',{method:'POST',body:new URLSearchParams({method:'smsGet',format:'json',apikey:key,did:number,direction:'in',startdate:String(start),enddate:String(end),page:String(page)}),signal:AbortSignal.timeout(25000)});
  if(!r.ok)throw Error('SMS provider is unavailable.');const payload=await r.json() as {status:boolean;data:Parameters<typeof normalizeMessage>[0][]};
  if(payload.status!==true||!Array.isArray(payload.data))throw Error('SMS provider could not complete the sync.');
  if(!payload.data.length){const time=new Date(end*1000).toISOString();await ingest({state:{last_sync:time}});return {added,lastSync:time};}
  const sig=payload.data.map(m=>m.smsid).join(',');if(sig===previous)throw Error('Provider pagination did not advance.');previous=sig;
  const messages=[];for(const raw of payload.data)if((raw.direction||raw.path)==='in'&&raw.destination.replace(/\D/g,'')===number&&raw.source!==number)messages.push(await associate(normalizeMessage(raw)));
  added+=await ingest({messages});
 }
 throw Error('More message pages remain; retry sync.');
}


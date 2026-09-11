import {env} from 'cloudflare:workers';
import {getBinding} from '@/db';
import directory from './directory.json';
import {classify} from './classifier';
import type {Hall,Message,Snapshot} from './types';
import crypto from 'node:crypto';

const halls=directory.halls as Hall[];
const seedVersion=crypto.createHash('sha256').update(JSON.stringify(halls)).digest('hex');
export function pacificDay(date:Date){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export async function seed(){
 const db=getBinding();
 const done=await db.prepare('SELECT value FROM sync_state WHERE key=?').bind('directory_version').first<{value:string}>();
 if(done?.value===seedVersion)return;
 for(let i=0;i<halls.length;i+=50)await db.batch(halls.slice(i,i+50).map(h=>db.prepare('INSERT INTO halls(id,name,city,region,record) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,city=excluded.city,region=excluded.region,record=excluded.record').bind(h.id,h.name,h.city||'',h.region,JSON.stringify(h))));
 await db.prepare('INSERT INTO sync_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('directory_version',seedVersion).run();
}
type RawSMS={smsid:string;source:string;destination:string;message:string;timestamp:string|number;direction?:string;path?:string};
export function normalizeMessage(m:RawSMS):Message{
 const receivedAt=new Date(Number(m.timestamp)*1000).toISOString();
 const result=classify({from:m.source,to:m.destination,body:m.message,receivedAt,messageId:m.smsid},{halls});
 const kind=/reply ["']?yes|birthdate|\(DOB\)|reply with your full name|welcome|thank you for (joining|subscribing)|msg.{0,10}freq|msg.{0,10}rates/i.test(m.message)?'subscription':'promotion';
 return {id:m.smsid,sender:m.source,body:m.message,receivedAt,day:pacificDay(new Date(receivedAt)),hallId:result.hallId,candidates:JSON.stringify(result.candidateHallIds),status:result.status,kind};
}
export async function sync(){
 await seed();const db=getBinding();
 const key=env.TD_API_KEY||process.env.TD_API_KEY,number=env.TD_NUMBER||process.env.TD_NUMBER;
 if(!key||!number)throw Error('SMS connection is not configured.');
 const last=await db.prepare('SELECT value FROM sync_state WHERE key=?').bind('last_sync').first<{value:string}>();
 if(last&&Date.now()-Date.parse(last.value)<55000)return {added:0,lastSync:last.value};
 const end=Math.floor(Date.now()/1000);
 const start=last?Math.max(1789110000,Math.floor(Date.parse(last.value)/1000)-86400):1789110000;
 let added=0;let previousPage='';let completed=false;
 for(let page=1;page<=100;page++){
  const response=await fetch('https://www.tossabledigits.com/apihttp.php',{method:'POST',body:new URLSearchParams({method:'smsGet',format:'json',apikey:key,did:number,direction:'in',startdate:String(start),enddate:String(end),page:String(page)}),signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error('SMS provider is unavailable. Try again shortly.');
  const payload=await response.json() as {status:boolean;data:RawSMS[]};
  if(payload.status!==true||!Array.isArray(payload.data))throw Error('SMS provider could not complete the sync.');
  const incoming=payload.data;if(!incoming.length){completed=true;break;}
  const pageSignature=incoming.map(m=>m.smsid).join(',');
  if(pageSignature===previousPage)throw Error('Provider pagination did not advance; saved messages are preserved.');
  previousPage=pageSignature;
  const rows=incoming.filter(m=>(m.direction||m.path)==='in'&&m.destination.replace(/\D/g,'')===number&&m.source!==number).map(normalizeMessage);
  for(let i=0;i<rows.length;i+=50){const results=await db.batch(rows.slice(i,i+50).map(m=>db.prepare('INSERT INTO messages(id,sender,body,received_at,day,hall_id,candidates,status,kind) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(m.id,m.sender,m.body,m.receivedAt,m.day,m.hallId,m.candidates,m.status,m.kind)));added+=results.reduce((n,r)=>n+(r.meta.changes||0),0);}
  // The provider's page size is not documented. Request until an empty page.
 }
 if(!completed)throw Error('More message pages remain. Saved messages are preserved; retry sync.');
 const time=new Date(end*1000).toISOString();
 await db.prepare('INSERT INTO sync_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('last_sync',time).run();
 return {added,lastSync:time};
}
export async function snapshot(day:string):Promise<Snapshot>{
 await seed();const db=getBinding();
 const [h,m,s]=await Promise.all([db.prepare('SELECT record FROM halls ORDER BY name').all<{record:string}>(),db.prepare('SELECT id,sender,body,received_at AS receivedAt,day,hall_id AS hallId,candidates,status,kind FROM messages WHERE day=? ORDER BY received_at DESC').bind(day).all<Message>(),db.prepare('SELECT value FROM sync_state WHERE key=?').bind('last_sync').first<{value:string}>()]);
 return {halls:h.results.map(x=>JSON.parse(x.record)),messages:m.results,lastSync:s?.value||null,connected:!!(env.TD_API_KEY||process.env.TD_API_KEY),cityCount:directory.cityCoverage.length};
}

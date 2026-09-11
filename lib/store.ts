import {env} from 'cloudflare:workers';
import {getBinding} from '@/db';
import directory from './directory.json';
import {classify} from './classifier';
import type {Hall,Message,Snapshot} from './types';
import crypto from 'node:crypto';
import {messageKind} from './message-kind';
import {identify,actionStatus,linksIn,linkKey,attributionVersion,verifiedLinks} from './attribution';
import {resolveLink} from './resolve-links';

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
 const kind=messageKind(m.message);
 return {id:m.smsid,sender:m.source,body:m.message,receivedAt,day:pacificDay(new Date(receivedAt)),hallId:result.hallId,candidates:JSON.stringify(result.candidateHallIds),status:result.status,kind};
}
const messageSelect='SELECT id,sender,body,received_at AS receivedAt,day,hall_id AS hallId,candidates,status,kind FROM messages';
async function associate(rows:Message[]){
 const db=getBinding();
 for(const m of rows){
  let result=identify(m,halls);
  if(!result.hallIds.length){const extra=[];for(const link of linksIn(m.body).slice(0,4))extra.push(await resolveLink(link,halls));result=identify(m,halls,extra);}
  const statements=[db.prepare('DELETE FROM message_halls WHERE message_id=?').bind(m.id),db.prepare('UPDATE messages SET hall_id=?,candidates=?,status=?,kind=? WHERE id=?').bind(result.hallIds.length===1?result.hallIds[0]:null,JSON.stringify(result.hallIds),result.hallIds.length>1?'shared_list':result.hallIds.length?'classified':'needs_review',messageKind(m.body),m.id)];
  for(const id of result.hallIds)statements.push(db.prepare('INSERT INTO message_halls(message_id,hall_id,evidence) VALUES(?,?,?)').bind(m.id,id,result.evidence));
  await db.batch(statements);
 }
}
async function reconcile(){
 const db=getBinding();const previous=await db.prepare('SELECT value FROM sync_state WHERE key=?').bind('attribution_version').first<{value:string}>();
 if(previous?.value===attributionVersion)return;
 for(const r of verifiedLinks)await db.prepare('INSERT INTO link_mappings(url,final_url,hall_ids,evidence,checked_at) VALUES(?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET final_url=excluded.final_url,hall_ids=excluded.hall_ids,evidence=excluded.evidence,checked_at=excluded.checked_at').bind(linkKey(r.url),('finalUrl' in r?r.finalUrl:r.url)||r.url,JSON.stringify(r.hallIds),r.evidence,new Date().toISOString()).run();
 const rows=await db.prepare(messageSelect).all<Message>();await associate(rows.results);
 await db.prepare('INSERT INTO sync_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('attribution_version',attributionVersion).run();
}
export async function sync(){
 await seed();await reconcile();const db=getBinding();
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
  const unlinked=await db.prepare(messageSelect+' WHERE id NOT IN (SELECT message_id FROM message_halls)').all<Message>();
  await associate(unlinked.results);
  // The provider's page size is not documented. Request until an empty page.
 }
 if(!completed)throw Error('More message pages remain. Saved messages are preserved; retry sync.');
 const time=new Date(end*1000).toISOString();
 await db.prepare('INSERT INTO sync_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('last_sync',time).run();
 return {added,lastSync:time};
}
export async function snapshot(day:string):Promise<Snapshot>{
 await seed();await reconcile();const db=getBinding();
 const [h,m,s]=await Promise.all([db.prepare('SELECT record FROM halls ORDER BY name').all<{record:string}>(),db.prepare('SELECT id,sender,body,received_at AS receivedAt,day,hall_id AS hallId,candidates,status,kind FROM messages WHERE kind=\'promotion\' AND day=? ORDER BY received_at DESC').bind(day).all<Message>(),db.prepare('SELECT value FROM sync_state WHERE key=?').bind('last_sync').first<{value:string}>()]);
 const summaryRows=await db.prepare('SELECT mh.hall_id AS hallId, COUNT(*) AS count, MAX(m.received_at) AS latestAt FROM message_halls mh JOIN messages m ON m.id=mh.message_id WHERE m.kind=\'promotion\' GROUP BY mh.hall_id').all<{hallId:string;count:number;latestAt:string}>();
 const latest=await db.prepare('SELECT m.id,m.sender,m.body,m.received_at AS receivedAt,m.day,m.hall_id AS hallId,m.candidates,m.status,m.kind,mh.hall_id AS forHall FROM message_halls mh JOIN messages m ON m.id=mh.message_id WHERE m.kind=\'promotion\' AND m.id=(SELECT mm.id FROM message_halls xx JOIN messages mm ON mm.id=xx.message_id WHERE xx.hall_id=mh.hall_id AND mm.kind=\'promotion\' ORDER BY mm.received_at DESC,mm.id DESC LIMIT 1)').all<Message&{forHall:string}>();
 const unassigned=await db.prepare('SELECT COUNT(*) AS count FROM messages WHERE kind=\'promotion\' AND id NOT IN (SELECT message_id FROM message_halls)').first<{count:number}>();
 return {halls:h.results.map(x=>JSON.parse(x.record)),messages:await enrich(m.results),lastSync:s?.value||null,connected:!!(env.TD_API_KEY||process.env.TD_API_KEY),cityCount:directory.cityCoverage.length,summaries:summaryRows.results.map(x=>({hallId:x.hallId,count:x.count,latest:latest.results.find(m=>m.forHall===x.hallId)||null})),unassignedCount:unassigned?.count||0};
}
async function enrich(rows:Message[]){
 const db=getBinding();const result:Message[]=[];
 for(const m of rows){const a=await db.prepare('SELECT hall_id AS hallId,evidence FROM message_halls WHERE message_id=?').bind(m.id).all<{hallId:string;evidence:string}>();const attr={hallIds:a.results.map(x=>x.hallId),evidence:a.results[0]?.evidence||'Hall identification pending.'};result.push({...m,...attr,actionStatus:actionStatus(m,halls,{...attr,...identify(m,halls),hallIds:attr.hallIds})});}return result;
}
export async function history(hallId:string,offset=0){
 await seed();await reconcile();const db=getBinding();
 const rows=await db.prepare(messageSelect+' WHERE kind=\'promotion\' AND id IN (SELECT message_id FROM message_halls WHERE hall_id=?) ORDER BY received_at DESC,id DESC LIMIT 101 OFFSET ?').bind(hallId,offset).all<Message>();
 return {messages:await enrich(rows.results.slice(0,100)),hasMore:rows.results.length>100};
}



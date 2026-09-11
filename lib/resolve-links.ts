import {getBinding} from '@/db';
import {linkKey,type Attribution} from './attribution';
import {classify} from './classifier';
import type {Hall} from './types';

const platforms=['login.bseennow.net','bseennow.net','tinyurl.com','www.tinyurl.com','mcpn.us','www.canva.com','canva.com','www.airmenu.com','airmenu.com','app.bingomenow.com','www.bingomenow.com','bingomenow.com','bcmeow.net'];
type CachedLink={final_url:string;hall_ids:string;evidence:string;checked_at:string};
export type LinkCache={get:(url:string)=>Promise<CachedLink|null>;set:(row:CachedLink&{url:string})=>Promise<void>};
export async function resolveLink(raw:string,halls:Hall[],cache?:LinkCache):Promise<Attribution>{
 const key=linkKey(raw);if(!key)return {hallIds:[],evidence:'Shared terms page; not a hall identifier.'};
 const db=cache?null:getBinding();
 const prior=cache?await cache.get(key):await db!.prepare('SELECT final_url,hall_ids,evidence,checked_at FROM link_mappings WHERE url=?').bind(key).first<CachedLink>();
 if(prior&&(JSON.parse(prior.hall_ids).length||Date.now()-Date.parse(prior.checked_at)<86400000))return {hallIds:JSON.parse(prior.hall_ids),evidence:prior.evidence};
 const allowed=new Set(platforms);
 for(const h of halls){try{const u=new URL(h.website||'');if(u.protocol==='https:')allowed.add(u.hostname);}catch{}}
 let current=new URL(raw);let finalUrl=current.href;let evidence='Link could not be identified automatically.';let hallIds:string[]=[];
 try{
  for(let step=0;step<7;step++){
   if(current.protocol!=='https:'||current.username||current.password||current.port&&!['443'].includes(current.port)||!allowed.has(current.hostname))throw Error('Destination needs review');
   if(/(?:unsubscribe|optout|opt-out|logout|delete)/i.test(current.pathname+current.search))throw Error('Action link skipped');
   const response=await fetch(current.href,{redirect:'manual',signal:AbortSignal.timeout(7000),headers:{Accept:'text/html'}});
   if(response.status>=300&&response.status<400){const location=response.headers.get('location');if(!location)break;current=new URL(location,current);continue;}
   finalUrl=current.href;
   if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))break;
   const reader=response.body?.getReader();if(!reader)break;let size=0,html='';const decoder=new TextDecoder();
   while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>500000){await reader.cancel();throw Error('Large page needs review');}html+=decoder.decode(part.value,{stream:true});}
   const body=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|amp);/g,' ').replace(/\s+/g,' ');
   const hrefs=[...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(m=>{try{return new URL(m[1].replace(/&amp;/g,'&'),current).href;}catch{return '';}});
   const result=classify({from:'link',body:body+' '+hrefs.join(' '),receivedAt:new Date().toISOString()},{halls});
   if(result.hallId){hallIds=[result.hallId];evidence='Linked page identifies '+halls.find(h=>h.id===result.hallId)?.name+' through page text or a hall-specific link. Destination: '+finalUrl;}
   else evidence='Opened '+finalUrl+'; no unique hall identified from its text and links. Image-only content may need review.';
   break;
  }
 }catch{evidence='Link needs review; destination was unavailable, unsupported, or could not be safely read.';}
 const row={url:key,final_url:finalUrl,hall_ids:JSON.stringify(hallIds),evidence,checked_at:new Date().toISOString()};
 if(cache)await cache.set(row);else await db!.prepare('INSERT INTO link_mappings(url,final_url,hall_ids,evidence,checked_at) VALUES(?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET final_url=excluded.final_url,hall_ids=excluded.hall_ids,evidence=excluded.evidence,checked_at=excluded.checked_at').bind(key,finalUrl,row.hall_ids,evidence,row.checked_at).run();
 return {hallIds,evidence};
}

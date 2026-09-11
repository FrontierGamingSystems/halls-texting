import rules from './attribution-rules.json';
import {classify} from './classifier';
import type {Hall,Message} from './types';
export type Attribution={hallIds:string[];evidence:string;actionStatus?:string};
export function linksIn(text:string){
 return [...new Set([...text.matchAll(/(?:https?:\/\/|www\.)[^\s<>"']+|(?:tinyurl\.com|login\.bseennow\.net|bseennow\.net|bcmeow\.net|bingomenow\.com|app\.bingomenow\.com)\/[^\s<>"']+/gi)].map(m=>{const s=m[0].replace(/[.,;!?)}\]]+$/,'');return /^https?:/i.test(s)?s:'https://'+s;}))];
}
export function linkKey(raw:string){
 try{
 const u=new URL(raw);u.hash='';
 if(u.hostname==='login.bseennow.net'&&u.pathname==='/p'){const c=u.searchParams.get('c');return c&&c!=='0'?u.origin+'/p?c='+encodeURIComponent(c):null;}
 if(u.hostname==='login.bseennow.net'&&u.pathname.startsWith('/b/'))return u.origin+u.pathname.split(':')[0];
 // All query identifiers are retained for other shared platforms, including AirMenu.
 return u.href;
 }catch{return null;}
}
export function identify(m:Message,halls:Hall[],extra:Attribution[]=[]):Attribution{
 const audited=(rules.messages as Record<string,Attribution>)[m.id];if(audited)return audited;
 const result=classify({from:m.sender,body:m.body,receivedAt:m.receivedAt,messageId:m.id},{halls});
 const matches:Attribution[]=[];
 if(result.hallId)matches.push({hallIds:[result.hallId],evidence:'Hall name or hall-specific website in message.'});
 for(const u of linksIn(m.body)){const key=linkKey(u);const known=rules.links.find(l=>linkKey(l.url)===key&&key!==null);if(known)matches.push(known);}
 matches.push(...extra.filter(x=>x.hallIds.length));
 const ids=[...new Set(matches.flatMap(x=>x.hallIds))];
 if(ids.length===1)return {hallIds:ids,evidence:matches.map(x=>x.evidence).join(' ')};
 if(ids.length>1)return {hallIds:[],evidence:'Conflicting hall clues require review: '+ids.join(', ')};
 if(/\bvanguard\b/i.test(m.body)&&result.candidateHallIds.length===2)return {hallIds:result.candidateHallIds,evidence:'Shared Vanguard subscription for Santa Clara and Redwood City; this message does not specify a single location.'};
 const sender=m.sender.replace(/\D/g,'');
 const dedicated=(rules.dedicatedSenders as Record<string,Attribution>)[sender];
 if(dedicated&&!result.candidateHallIds.length)return dedicated;
 return {hallIds:[],evidence:result.reason};
}
export function actionStatus(m:Message,halls:Hall[],a:Attribution){
 if(a.actionStatus)return a.actionStatus;
 if(/birthdate|\(DOB\)/i.test(m.body))return 'Birthdate required';
 if(/reply\s+["']?YES\b/i.test(m.body)&&a.hallIds.length&&a.hallIds.every(id=>halls.find(h=>h.id===id)?.enrollmentStatus==='confirmed'))return 'Opt-in completed';
 if(/reply\s+["']?YES\b/i.test(m.body))return 'Confirmation requested';
 return '';
}
export const attributionVersion=rules.version;
export const verifiedLinks=rules.links;

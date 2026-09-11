import {getChatGPTUser} from '@/app/chatgpt-auth';
import {snapshot,sync,pacificDay} from '@/lib/store';
import {env} from 'cloudflare:workers';
import {timingSafeEqual} from 'node:crypto';
function serviceAuthorized(request:Request){
 const expected=env.BINGO_SYNC_KEY||process.env.BINGO_SYNC_KEY;
 const provided=request.headers.get('x-bingo-sync-key');
 return !!expected&&!!provided&&Buffer.byteLength(expected)===Buffer.byteLength(provided)&&timingSafeEqual(Buffer.from(expected),Buffer.from(provided));
}
export async function GET(request:Request){
 if(!serviceAuthorized(request)&&!await getChatGPTUser())return Response.json({error:'Sign in to view messages.'},{status:401});
 const day=new URL(request.url).searchParams.get('day')||pacificDay(new Date());
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return Response.json({error:'Invalid date.'},{status:400});
 try{return Response.json(await snapshot(day),{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({error:'The message database is unavailable. Please try again.'},{status:503});}
}
export async function POST(request:Request){
 const service=serviceAuthorized(request);
 if(!service&&!await getChatGPTUser())return Response.json({error:'Sign in to sync messages.'},{status:401});
 if(!service&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid request origin.'},{status:403});
 try{return Response.json(await sync(),{headers:{'Cache-Control':'private, no-store'}});}catch(error){return Response.json({error:error instanceof Error?error.message:'Sync failed.'},{status:502});}
}

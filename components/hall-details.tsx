import type {Hall} from '@/lib/types';
export function HallDetails({hall}:{hall:Hall}){
 const schedule=hall.schedule, presales=hall.presales;
 return <section className="hall-facts" aria-label="Hall details">
  <dl>
   {hall.operatingStatus&&hall.operatingStatus!=='published_recurring'&&<div><dt>Program status</dt><dd>{hall.operatingStatus.replaceAll('_',' ')}</dd></div>}
   <div><dt>Website</dt><dd>{hall.website?<a href={hall.website} target="_blank" rel="noreferrer">{hall.website.replace(/^https?:\/\//,'').replace(/\/$/,'')} ↗</a>:'Website not verified'}</dd></div>
   <div><dt>Address</dt><dd>{hall.address||'Exact address not verified'}{hall.addressSourceUrl&&<a className="fact-source" href={hall.addressSourceUrl} target="_blank" rel="noreferrer">Address source ↗</a>}</dd></div>
   <div><dt>Bingo days</dt><dd>{schedule?<>{schedule.evidenceStatus&&<p className="schedule-status">{schedule.evidenceStatus.replaceAll('_',' ')} — confirm current dates</p>}<strong>{schedule.days.join(' · ')||'See schedule'}</strong><p>{schedule.details}</p><a className="fact-source" href={schedule.sourceUrl} target="_blank" rel="noreferrer">Published schedule ↗</a></>:'Operating days not yet verified'}</dd></div>
   <div><dt>Platforms</dt><dd>{hall.platforms?.length?<ul>{hall.platforms.map((p,i)=><li key={i}><a href={p.url} target="_blank" rel="noreferrer">{p.name} ↗</a><p>{p.evidence}</p></li>)}</ul>:'BingoMeNow / sales platform not yet verified'}</dd></div>
   <div><dt>Advance sales</dt><dd>{presales?<><strong>{presales.status==='available'?'Advance sales found':presales.status==='not_found'?'No advance sales found on checked pages':'Current availability unclear'}</strong><p>{presales.details}</p>{(presales.url||presales.sourceUrl)&&<a className="fact-source" href={presales.url||presales.sourceUrl} target="_blank" rel="noreferrer">{presales.status==='available'?'View '+(presales.platform||'sales page'):'View evidence'} ↗</a>}</>:'Not yet checked'}</dd></div>
   <div><dt>Text signup</dt><dd>{hall.signup?.method==='keyword'?<>Text <strong>{hall.signup.keyword}</strong> to {hall.signup.destination}</>:hall.signup?'Online signup form':'No text signup verified'}{hall.signup?.sourceUrl&&<a className="fact-source" href={hall.signup.sourceUrl} target="_blank" rel="noreferrer">Signup source ↗</a>}</dd></div>
  </dl>
  {(hall.lastResearchedAt||schedule?.verifiedAt)&&<p className="facts-checked">Website checked {hall.lastResearchedAt||schedule?.verifiedAt}. Check the hall’s schedule for cancellations and special events.</p>}
 </section>;
}

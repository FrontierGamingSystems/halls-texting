export type Signup={method:string;keyword?:string|null;destination?:string|null;url?:string|null;sourceUrl?:string|null;subscriptionKey?:string|null;note?:string|null};
export type Schedule={days:string[];details:string;sourceUrl:string;verifiedAt:string;evidenceStatus?:string};
export type Platform={name:string;url:string;evidence:string};
export type Presales={status:'available'|'not_found'|'unclear';platform?:string|null;url?:string|null;details:string;sourceUrl?:string;verifiedAt?:string};
export type Hall={id:string;name:string;address:string;city:string;region:string;website:string|null;signup:Signup|null;enrollmentStatus:string;operatorNotes?:string;researchStatus?:string;sourceUrls?:string[];schedule?:Schedule|null;addressSourceUrl?:string;platforms?:Platform[];presales?:Presales|null;lastResearchedAt?:string;operatingStatus?:string};
export type Message={id:string;sender:string;body:string;receivedAt:string;day:string;hallId:string|null;candidates:string;status:string;kind:string;hallIds?:string[];evidence?:string;actionStatus?:string};
export type HallSummary={hallId:string;count:number;latest:Message|null};
export type Snapshot={halls:Hall[];messages:Message[];lastSync:string|null;connected:boolean;cityCount:number;summaries:HallSummary[];unassignedCount:number};

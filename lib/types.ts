export type Signup={method:string;keyword?:string|null;destination?:string|null;url?:string|null;sourceUrl?:string|null;subscriptionKey?:string|null;note?:string|null};
export type Hall={id:string;name:string;address:string;city:string;region:string;website:string|null;signup:Signup|null;enrollmentStatus:string;operatorNotes?:string;researchStatus?:string;sourceUrls?:string[]};
export type Message={id:string;sender:string;body:string;receivedAt:string;day:string;hallId:string|null;candidates:string;status:string;kind:string;hallIds?:string[];evidence?:string;actionStatus?:string};
export type HallSummary={hallId:string;count:number;latest:Message|null};
export type Snapshot={halls:Hall[];messages:Message[];lastSync:string|null;connected:boolean;cityCount:number;summaries:HallSummary[];unassignedCount:number};

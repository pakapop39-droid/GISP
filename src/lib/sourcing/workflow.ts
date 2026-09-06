import type { SourcingStatus } from "./types";
const transitions:Record<SourcingStatus,readonly SourcingStatus[]>={DRAFT:["SUBMITTED","CANCELLED"],SUBMITTED:["UNDER_REVIEW","CANCELLED"],UNDER_REVIEW:["NEED_INFO","OPTIONS_READY","UNAVAILABLE","CANCELLED"],NEED_INFO:["SUBMITTED","CANCELLED"],OPTIONS_READY:["MEMBER_SELECTED","UNDER_REVIEW","CANCELLED"],MEMBER_SELECTED:["CATALOG_PENDING","COMPLETED"],CATALOG_PENDING:["COMPLETED"],COMPLETED:[],UNAVAILABLE:[],CANCELLED:[]};
export function canTransitionSourcing(from:SourcingStatus,to:SourcingStatus){return transitions[from].includes(to)}


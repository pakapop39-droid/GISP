import "server-only";
import { AppAccessError,requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import type { sourcingRequestSchema } from "./schema";

export const sourcingRequestColumns="id,organization_id,member_profile_id,project_id,area_id,request_number,item_name,description,match_preference,quantity,unit,width_mm,depth_mm,height_mm,requested_material,requested_color,budget_max,currency,needed_at,source_url,member_note,status,submitted_at,created_at,updated_at";
export async function requireMember(){const context=await requireAppAccess({active:true});if(!context.roles.includes("MEMBER"))throw new AppAccessError("PERMISSION_DENIED",403,"หน้านี้สำหรับสมาชิก");return context}
export async function requireSourcingAdmin(){return requireAppAccess({active:true,permissions:["sourcing.manage"]})}
export function sourcingRpcInput(input:ReturnType<typeof sourcingRequestSchema.parse>){return {project_id_input:input.projectId,area_id_input:input.areaId,item_name_input:input.itemName,description_input:input.description,match_preference_input:input.matchPreference,quantity_input:input.quantity,unit_input:input.unit,width_mm_input:input.widthMm,depth_mm_input:input.depthMm,height_mm_input:input.heightMm,requested_material_input:input.requestedMaterial,requested_color_input:input.requestedColor,budget_max_input:input.budgetMax,needed_at_input:input.neededAt,source_url_input:input.sourceUrl,member_note_input:input.memberNote}}

export async function loadMemberSourcingDetail(requestId:string,memberProfileId:string){
 const admin=createInsForgeAdminClient();const request=await admin.database.from("product_sourcing_requests").select(sourcingRequestColumns).eq("id",requestId).eq("member_profile_id",memberProfileId).maybeSingle();if(request.error)throw request.error;if(!request.data)return null;
 const [files,candidates,history]=await Promise.all([
  admin.database.from("product_sourcing_files").select("file_id,sort_order").eq("request_id",requestId).order("sort_order").limit(8),
  admin.database.from("product_sourcing_candidates").select("id,product_id,name_th,name_en,description,specification_summary,material_summary,finish_summary,member_price_before_vat,currency,lead_time_days,status,presented_at,selected_at").eq("request_id",requestId).in("status",["PRESENTED","SELECTED","NOT_SELECTED","DECLINED"]).order("created_at").limit(20),
  admin.database.from("product_sourcing_history").select("id,action,from_status,to_status,message,created_at").eq("request_id",requestId).eq("visibility","MEMBER").order("created_at").limit(200),
 ]);for(const result of [files,candidates,history])if(result.error)throw result.error;
 const fileIds=(files.data??[]).map(item=>item.file_id);const metadata=fileIds.length?await admin.database.from("file_metadata").select("id,original_name,mime_type,size_bytes").in("id",fileIds).limit(8):{data:[],error:null};if(metadata.error)throw metadata.error;
 const candidateIds=(candidates.data??[]).map(item=>item.id);const candidateFiles=candidateIds.length?await admin.database.from("product_sourcing_candidate_files").select("candidate_id,file_id,sort_order").in("candidate_id",candidateIds).order("sort_order").limit(200):{data:[],error:null};if(candidateFiles.error)throw candidateFiles.error;
 const imageByCandidate=new Map<string,string>();for(const item of candidateFiles.data??[])if(!imageByCandidate.has(item.candidate_id))imageByCandidate.set(item.candidate_id,item.file_id);
 return {request:request.data,files:metadata.data??[],candidates:(candidates.data??[]).map(item=>({...item,imageFileId:imageByCandidate.get(item.id)??null})),history:history.data??[]};
}

import { createAdminClient, createClient } from "@insforge/sdk";
import { getUatPassword, UAT_ADMIN_EMAIL, UAT_MEMBER_EMAIL } from "./uat-password.mjs";

const baseUrl=process.env.INSFORGE_URL,apiKey=process.env.INSFORGE_API_KEY,anonKey=process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
if(!baseUrl||!apiKey||!anonKey) throw new Error("Slice 7 branch test environment is incomplete");
const admin=createAdminClient({baseUrl,apiKey}); const password=getUatPassword(); const runId=Date.now(); const results=[];
const assert=(value,label)=>{if(!value)throw new Error(`FAILED: ${label}`);results.push(`PASS: ${label}`)};
const must=(result,label)=>{if(result.error)throw new Error(`${label}: ${result.error.message}`);return result.data};
async function signIn(email){const client=createClient({baseUrl,anonKey});must(await client.auth.signInWithPassword({email,password}),`sign in ${email}`);return client}
const operator=await signIn(UAT_ADMIN_EMAIL); const member=await signIn(UAT_MEMBER_EMAIL);
const operatorUser=must(await operator.auth.getCurrentUser(),"operator user").user;
const memberUser=must(await member.auth.getCurrentUser(),"member user").user;
const profile=must(await admin.database.from("member_profiles").select("id,user_id,organization_id").eq("user_id",memberUser.id).single(),"member profile");
const supplier=must(await admin.database.from("suppliers").select("id").eq("status","ACTIVE").limit(1).single(),"active supplier");

const project=must(await admin.database.from("projects").insert([{
  organization_id:profile.organization_id,member_profile_id:profile.id,project_number:`PRJ-S7-UAT-${runId}`,
  name:`Slice 7 UAT Production QC ${runId}`,site_address:"Bangkok — Slice 7 UAT",status:"ACTIVE",created_by:profile.user_id,
}]).select("id,project_number,name").single(),"create project");
const projectItems=must(await admin.database.from("project_items").insert([
  {project_id:project.id,organization_id:profile.organization_id,item_type:"STANDARD",item_name:"โต๊ะมาตรฐาน Slice 7",specification_snapshot:"ไม้โอ๊ก 1800 มม.",selected_options:[],quantity:1,unit:"EA",current_unit_price:100000,vat_rate_snapshot:7,status:"ORDERED",ordered_quantity:1,created_by:profile.user_id},
  {project_id:project.id,organization_id:profile.organization_id,item_type:"CUSTOM",item_name:"ตู้ Custom Slice 7",specification_snapshot:"ทำตามขนาดหน้างาน",selected_options:[],quantity:1,unit:"EA",current_unit_price:100000,vat_rate_snapshot:7,status:"ORDERED",ordered_quantity:1,created_by:profile.user_id},
]).select("id,item_type,item_name").order("item_type"),"create project items");
const standardProjectItem=projectItems.find(row=>row.item_type==="STANDARD"),customProjectItem=projectItems.find(row=>row.item_type==="CUSTOM");
if(!standardProjectItem||!customProjectItem)throw new Error("project items missing");
const order=must(await admin.database.from("customer_orders").insert([{
  organization_id:profile.organization_id,member_profile_id:profile.id,project_id:project.id,
  order_number:`ORD-S7-${runId}`,status:"PO_ISSUED",currency:"THB",subtotal:200000,vat_rate_snapshot:7,
  vat_amount:14000,grand_total:214000,deposit_amount:107000,balance_amount:107000,
  deposit_verified_at:new Date().toISOString(),shipping_address_snapshot:{site_address:"Bangkok"},created_by:profile.user_id,
}]).select("id,order_number").single(),"create order");
const orderItems=must(await admin.database.from("order_items").insert([
  {order_id:order.id,organization_id:profile.organization_id,project_item_id:standardProjectItem.id,item_type:"STANDARD",item_name_snapshot:standardProjectItem.item_name,specification_snapshot:"ไม้โอ๊ก 1800 มม.",options_snapshot:[],quantity:1,unit:"EA",unit_price_snapshot:100000,line_subtotal:100000,vat_rate_snapshot:7,vat_amount:7000,line_total:107000},
  {order_id:order.id,organization_id:profile.organization_id,project_item_id:customProjectItem.id,item_type:"CUSTOM",item_name_snapshot:customProjectItem.item_name,specification_snapshot:"ทำตามขนาดหน้างาน",options_snapshot:[],quantity:1,unit:"EA",unit_price_snapshot:100000,line_subtotal:100000,vat_rate_snapshot:7,vat_amount:7000,line_total:107000},
]).select("id,item_type,item_name_snapshot"),"create order items");
const standard=orderItems.find(row=>row.item_type==="STANDARD"),custom=orderItems.find(row=>row.item_type==="CUSTOM");
if(!standard||!custom)throw new Error("order items missing");
const supplierOrder=must(await admin.database.from("supplier_orders").insert([{
  customer_order_id:order.id,organization_id:profile.organization_id,supplier_id:supplier.id,
  supplier_order_number:`SO-S7-${runId}`,po_number:`PO-S7-${runId}`,status:"PO_ISSUED",supplier_currency:"CNY",
  total_factory_cost:100000,paid_factory_amount:50000,po_issued_at:new Date().toISOString(),
}]).select("id").single(),"create supplier order");
must(await admin.database.from("supplier_order_items").insert(orderItems.map(item=>({supplier_order_id:supplierOrder.id,order_item_id:item.id,quantity:1,factory_unit_cost_snapshot:50000,factory_line_total:50000}))),"link supplier items");
must(await admin.database.from("payment_schedules").insert([
  {order_id:order.id,organization_id:profile.organization_id,schedule_type:"DEPOSIT",due_amount:107000,verified_amount:107000,status:"VERIFIED",verified_at:new Date().toISOString()},
  {order_id:order.id,organization_id:profile.organization_id,schedule_type:"BALANCE",due_amount:107000,verified_amount:0,status:"PENDING"},
]),"create payment schedules");

const earlyQc=await operator.database.rpc("record_qc_inspection",{order_item_id_input:standard.id,result_input:"PASSED",checklist_input:[{code:"DIM",label:"ขนาด",result:"PASSED"}],note_input:"early",defect_note_input:null,rework_note_input:null,inspection_type_input:"INITIAL",parent_inspection_id_input:null,file_ids_input:[]});
assert(Boolean(earlyQc.error),"QC is blocked until production is completed");
const productionObjectKey=`slice7-test/${runId}-production.png`;
const productionBytes=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64");
must(await admin.storage.from("gisp-member-private").upload(productionObjectKey,new File([productionBytes],"production-progress.png",{type:"image/png"})),"upload production evidence");
const media=must(await admin.database.from("file_metadata").insert([{
  organization_id:profile.organization_id,member_profile_id:profile.id,bucket:"gisp-member-private",object_key:productionObjectKey,original_name:"production-progress.png",mime_type:"image/png",size_bytes:productionBytes.length,visibility:"MEMBER_PRIVATE",entity_type:"PRODUCTION_MEDIA",entity_id:supplierOrder.id,uploaded_by:operatorUser.id,
}]).select("id").single(),"create production media metadata");
must(await operator.database.rpc("add_production_update",{supplier_order_id_input:supplierOrder.id,status_input:"ACKNOWLEDGED",note_input:"Factory confirmed",estimated_completion_at_input:new Date(Date.now()+86400000*30).toISOString(),progress_percent_input:0,started_at_input:null,actual_completed_at_input:null,delay_reason_input:null,file_ids_input:[media.id]}),"acknowledge production");
const belowStatusBaseline=await operator.database.rpc("add_production_update",{supplier_order_id_input:supplierOrder.id,status_input:"IN_PRODUCTION",note_input:null,estimated_completion_at_input:null,progress_percent_input:5,started_at_input:null,actual_completed_at_input:null,delay_reason_input:null,file_ids_input:[]});
assert(Boolean(belowStatusBaseline.error),"production progress respects the status baseline");
must(await operator.database.rpc("add_production_update",{supplier_order_id_input:supplierOrder.id,status_input:"IN_PRODUCTION",note_input:"Production started",estimated_completion_at_input:new Date(Date.now()+86400000*20).toISOString(),progress_percent_input:45,started_at_input:new Date().toISOString(),actual_completed_at_input:null,delay_reason_input:null,file_ids_input:[]}),"start production");
const decreasingProgress=await operator.database.rpc("add_production_update",{supplier_order_id_input:supplierOrder.id,status_input:"IN_PRODUCTION",note_input:null,estimated_completion_at_input:null,progress_percent_input:40,started_at_input:null,actual_completed_at_input:null,delay_reason_input:null,file_ids_input:[]});
assert(Boolean(decreasingProgress.error),"overall production progress cannot decrease");
const backwards=await operator.database.rpc("add_production_update",{supplier_order_id_input:supplierOrder.id,status_input:"MATERIAL_PREPARATION",note_input:null,estimated_completion_at_input:null,progress_percent_input:20,started_at_input:null,actual_completed_at_input:null,delay_reason_input:null,file_ids_input:[]});
assert(Boolean(backwards.error),"production status cannot move backwards");
const delayWithoutReason=await operator.database.rpc("add_production_update",{supplier_order_id_input:supplierOrder.id,status_input:"DELAYED",note_input:null,estimated_completion_at_input:null,progress_percent_input:45,started_at_input:null,actual_completed_at_input:null,delay_reason_input:null,file_ids_input:[]});
assert(Boolean(delayWithoutReason.error),"delay requires a reason");
const delayChangesProgress=await operator.database.rpc("add_production_update",{supplier_order_id_input:supplierOrder.id,status_input:"DELAYED",note_input:null,estimated_completion_at_input:null,progress_percent_input:50,started_at_input:null,actual_completed_at_input:null,delay_reason_input:"ทดสอบการคงเปอร์เซ็นต์",file_ids_input:[]});
assert(Boolean(delayChangesProgress.error),"delayed status retains the latest production progress");
must(await operator.database.rpc("add_production_update",{supplier_order_id_input:supplierOrder.id,status_input:"DELAYED",note_input:"ETA revised",estimated_completion_at_input:new Date(Date.now()+86400000*25).toISOString(),progress_percent_input:45,started_at_input:null,actual_completed_at_input:null,delay_reason_input:"วัสดุมาถึงช้ากว่ากำหนด",file_ids_input:[]}),"record delay");
must(await operator.database.rpc("add_production_update",{supplier_order_id_input:supplierOrder.id,status_input:"PRODUCTION_COMPLETED",note_input:"Ready for QC",estimated_completion_at_input:null,progress_percent_input:100,started_at_input:null,actual_completed_at_input:new Date().toISOString(),delay_reason_input:null,file_ids_input:[]}),"complete production");
const productionRows=must(await member.database.from("production_updates").select("id,status,progress_percent").eq("supplier_order_id",supplierOrder.id),"member reads production timeline");
assert(productionRows.length===4&&productionRows.some(row=>row.status==="DELAYED"),"member sees member-safe timeline and delay history");
const directProductionWrite=await member.database.from("production_updates").insert([{supplier_order_id:supplierOrder.id,organization_id:profile.organization_id,status:"PRODUCTION_COMPLETED",created_by:memberUser.id}]);
assert(Boolean(directProductionWrite.error),"member cannot forge a production update");

const badPassed=await operator.database.rpc("record_qc_inspection",{order_item_id_input:standard.id,result_input:"PASSED",checklist_input:[{code:"DIM",label:"ขนาด",result:"FAILED"}],note_input:null,defect_note_input:null,rework_note_input:null,inspection_type_input:"INITIAL",parent_inspection_id_input:null,file_ids_input:[]});
assert(Boolean(badPassed.error),"PASSED result is rejected when a checklist item failed");
const checklist=[{code:"DIM",label:"ขนาดและสเปก",result:"PASSED"},{code:"MAT",label:"วัสดุและสี",result:"PASSED"},{code:"FIN",label:"งานประกอบและผิวสำเร็จ",result:"PASSED"}];
must(await operator.database.rpc("record_qc_inspection",{order_item_id_input:standard.id,result_input:"PASSED",checklist_input:checklist,note_input:"Standard passed",defect_note_input:null,rework_note_input:null,inspection_type_input:"INITIAL",parent_inspection_id_input:null,file_ids_input:[]}),"pass standard QC");
const customInspection=must(await operator.database.rpc("record_qc_inspection",{order_item_id_input:custom.id,result_input:"PASSED",checklist_input:checklist,note_input:"Custom waits member",defect_note_input:null,rework_note_input:null,inspection_type_input:"INITIAL",parent_inspection_id_input:null,file_ids_input:[]}),"pass custom QC");
let customState=must(await admin.database.from("order_items").select("qc_status").eq("id",custom.id).single(),"read custom QC state");
assert(customState.qc_status==="WAITING_MEMBER_APPROVAL","custom QC requires explicit member approval");
must(await member.database.rpc("respond_custom_qc",{order_item_id_input:custom.id,decision_input:"ADDITIONAL_REVIEW_REQUESTED",note_input:"ขอตรวจรอยต่อด้านในเพิ่ม"}),"request additional review");
const reviewEvent=must(await admin.database.from("qc_inspections").select("id,result,parent_inspection_id").eq("order_item_id",custom.id).eq("result","REWORK_REQUIRED").order("inspected_at",{ascending:false}).limit(1).single(),"read immutable review event");
assert(reviewEvent.parent_inspection_id===customInspection,"additional-review decision creates a linked rework event");
must(await operator.database.rpc("record_qc_inspection",{order_item_id_input:custom.id,result_input:"PASSED",checklist_input:checklist,note_input:"Reinspection passed",defect_note_input:null,rework_note_input:"ตรวจรอยต่อด้านในแล้ว",inspection_type_input:"REINSPECTION",parent_inspection_id_input:reviewEvent.id,file_ids_input:[]}),"reinspect custom item");
must(await member.database.rpc("respond_custom_qc",{order_item_id_input:custom.id,decision_input:"APPROVED",note_input:"ตรวจหลักฐานแล้ว"}),"member approves custom QC");
customState=must(await admin.database.from("order_items").select("qc_status,custom_member_approved_at").eq("id",custom.id).single(),"read approved custom QC");
assert(customState.qc_status==="MEMBER_APPROVED"&&Boolean(customState.custom_member_approved_at),"member approval is recorded with timestamp");
let gate=must(await member.database.rpc("get_dispatch_gate",{order_item_id_input:custom.id}),"read blocked dispatch gate");
assert(!gate.can_dispatch&&gate.qc_passed&&gate.member_approved&&!gate.customer_balance_verified&&!gate.supplier_balance_paid,"dispatch gate reports the two remaining finance conditions");
must(await admin.database.from("payment_schedules").update({verified_amount:107000,status:"VERIFIED",verified_at:new Date().toISOString()}).eq("order_id",order.id).eq("schedule_type","BALANCE"),"verify customer balance fixture");
must(await admin.database.from("supplier_orders").update({paid_factory_amount:100000,supplier_balance_paid_at:new Date().toISOString()}).eq("id",supplierOrder.id),"pay supplier balance fixture");
gate=must(await member.database.rpc("get_dispatch_gate",{order_item_id_input:custom.id}),"read ready dispatch gate");
assert(gate.can_dispatch&&gate.customer_balance_verified&&gate.supplier_balance_paid,"all four backend conditions open the dispatch gate");
const memberInspections=must(await member.database.from("qc_inspections").select("id,result,inspection_type").eq("order_item_id",custom.id),"member reads QC history");
const decisions=must(await member.database.from("qc_member_decisions").select("decision,note").eq("order_item_id",custom.id),"member reads decision history");
assert(memberInspections.length>=3&&decisions.length===2,"QC, rework, reinspection and both member decisions remain in history");
const mutateHistory=await member.database.from("qc_member_decisions").update({note:"changed"}).eq("order_item_id",custom.id);
assert(Boolean(mutateHistory.error),"append-only member decision history cannot be changed");

for(const line of results)console.log(line);
console.log(`Slice 7 branch integration complete: ${results.length} assertions`);
console.log(`UAT member: ${UAT_MEMBER_EMAIL}`);
console.log(`UAT admin: ${UAT_ADMIN_EMAIL}`);
console.log(`UAT password: ${password}`);
console.log(`UAT project: ${project.project_number} — ${project.name}`);
console.log(`UAT order: ${order.order_number}`);

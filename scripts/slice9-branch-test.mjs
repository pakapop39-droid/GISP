import { createAdminClient, createClient } from "@insforge/sdk";
import { getUatPassword, UAT_ADMIN_EMAIL, UAT_MEMBER_EMAIL } from "./uat-password.mjs";

const baseUrl=process.env.INSFORGE_URL,apiKey=process.env.INSFORGE_API_KEY,anonKey=process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
if(!baseUrl||!apiKey||!anonKey)throw new Error("Slice 9 branch test environment is incomplete");
if(!baseUrl.includes("kit6y4pj-hur"))throw new Error("Refusing to test outside Slice 9 backend branch");
const admin=createAdminClient({baseUrl,apiKey}),password=getUatPassword(),runId=Date.now(),results=[];
const must=(result,label)=>{if(result.error)throw new Error(`${label}: ${result.error.message}`);return result.data};
const assert=(value,label)=>{if(!value)throw new Error(`FAILED: ${label}`);results.push(`PASS: ${label}`)};
async function signIn(email){const client=createClient({baseUrl,anonKey});must(await client.auth.signInWithPassword({email,password}),`sign in ${email}`);return client}
const operator=await signIn(UAT_ADMIN_EMAIL),member=await signIn(UAT_MEMBER_EMAIL);
const operatorUser=must(await operator.auth.getCurrentUser(),"operator user").user;
const memberUser=must(await member.auth.getCurrentUser(),"member user").user;
const profile=must(await admin.database.from("member_profiles").select("id,user_id,organization_id").eq("user_id",memberUser.id).single(),"member profile");
const order=must(await admin.database.from("customer_orders").select("id,project_id,organization_id,order_number").eq("member_profile_id",profile.id).order("created_at",{ascending:false}).limit(1).single(),"member order");
const delivery=must(await admin.database.from("deliveries").select("id,status").eq("customer_order_id",order.id).in("status",["DELIVERED","DELIVERED_WITH_ISSUE"]).limit(1).single(),"delivered order");
const projectItem=must(await admin.database.from("project_items").insert([{
  project_id:order.project_id,organization_id:profile.organization_id,item_type:"STANDARD",item_name:`เก้าอี้ทดสอบ Claim ${runId}`,
  specification_snapshot:"เก้าอี้ไม้โอ๊กสำหรับ Automated Test",selected_options:[],quantity:1,unit:"EA",current_unit_price:10000,
  vat_rate_snapshot:7,status:"ORDERED",ordered_quantity:1,created_by:memberUser.id,
}]).select("id,item_name").single(),"create claim test project item");
const orderItem=must(await admin.database.from("order_items").insert([{
  order_id:order.id,organization_id:profile.organization_id,project_item_id:projectItem.id,item_type:"STANDARD",
  item_name_snapshot:projectItem.item_name,specification_snapshot:"Automated test",options_snapshot:[],quantity:1,unit:"EA",
  unit_price_snapshot:10000,line_subtotal:10000,vat_rate_snapshot:7,vat_amount:700,line_total:10700,qc_status:"PASSED",
}]).select("id").single(),"create claim test order item");
const deliveredItem=must(await admin.database.from("delivery_items").insert([{
  delivery_id:delivery.id,organization_id:profile.organization_id,order_item_id:orderItem.id,quantity_delivered:1,
  expected_quantity:1,remaining_quantity:0,condition:"GOOD",note:"Slice 9 automated test",
}]).select("id").single(),"create delivered test item");

async function evidence(name){
  const key=`slice9-test/${runId}-${name}.png`,bytes=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64");
  const uploaded=must(await admin.storage.from("gisp-member-private").upload(key,new File([bytes],`${name}.png`,{type:"image/png"})),`upload ${name}`);
  return must(await admin.database.from("file_metadata").insert([{
    organization_id:profile.organization_id,member_profile_id:profile.id,bucket:"gisp-member-private",object_key:key,url:uploaded.url,
    original_name:`${name}.png`,mime_type:"image/png",size_bytes:bytes.length,visibility:"MEMBER_PRIVATE",entity_type:"CLAIM_EVIDENCE",uploaded_by:memberUser.id,
  }]).select("id").single(),`metadata ${name}`).id;
}
const issueEvidence=await evidence("issue");
const resolutionEvidence=await evidence("resolution");
const claimId=must(await member.database.rpc("create_claim",{
  delivery_item_id_input:deliveredItem.id,issue_type_input:"TRANSIT_DAMAGE",subject_input:"มุมเก้าอี้เสียหายระหว่างขนส่ง",
  description_input:"พบรอยแตกที่มุมเก้าอี้ทันทีหลังเปิดกล่อง",claimed_quantity_input:1,severity_input:"HIGH",
  discovered_at_input:new Date().toISOString(),packaging_condition_input:"กล่องบุบด้านขวา",temporary_action_input:"แยกสินค้าไว้",
  evidence_file_id_input:issueEvidence,
}),"member creates claim");
const claim=must(await member.database.from("claims").select("id,status,suggested_responsibility,warranty_snapshot").eq("id",claimId).single(),"member reads own claim");
assert(claim.status==="SUBMITTED","new claim is SUBMITTED");
assert(claim.suggested_responsibility==="LOGISTICS_INSURANCE","transit damage suggests logistics/insurance");
assert(Boolean(claim.warranty_snapshot?.captured_at),"warranty snapshot captured at claim creation");
const overClaim=await member.database.rpc("create_claim",{
  delivery_item_id_input:deliveredItem.id,issue_type_input:"DAMAGED",subject_input:"ทดสอบจำนวนเกินยอดส่งมอบ",description_input:"ทดสอบว่าระบบไม่ให้เคลมจำนวนเกินยอดส่งจริง",
  claimed_quantity_input:1,severity_input:"LOW",discovered_at_input:new Date().toISOString(),packaging_condition_input:null,temporary_action_input:null,evidence_file_id_input:issueEvidence,
});
assert(Boolean(overClaim.error),"active claimed quantity cannot exceed delivered quantity");
const warrantyMutation=await admin.database.from("claims").update({warranty_snapshot:{title:"changed"}}).eq("id",claimId);
assert(Boolean(warrantyMutation.error),"warranty snapshot is immutable");
must(await operator.database.rpc("admin_claim_action",{claim_id_input:claimId,action_input:"START_REVIEW",note_input:"เริ่มตรวจหลักฐาน",responsibility_input:null,resolution_type_input:null,evidence_file_id_input:null,assigned_to_input:operatorUser.id,target_resolution_at_input:null}),"start review");
must(await operator.database.rpc("admin_claim_action",{claim_id_input:claimId,action_input:"REQUEST_INFORMATION",note_input:"ขอภาพมุมกล่องเพิ่มเติม",responsibility_input:null,resolution_type_input:null,evidence_file_id_input:null,assigned_to_input:null,target_resolution_at_input:null}),"request information");
must(await member.database.rpc("member_claim_action",{claim_id_input:claimId,action_input:"ADD_INFORMATION",note_input:"ตรวจสอบแล้วกล่องบุบจริง",evidence_file_id_input:null}),"member adds information");
must(await operator.database.rpc("admin_claim_action",{claim_id_input:claimId,action_input:"CONFIRM_RESPONSIBILITY",note_input:null,responsibility_input:"LOGISTICS_INSURANCE",resolution_type_input:null,evidence_file_id_input:null,assigned_to_input:null,target_resolution_at_input:null}),"confirm responsibility");
must(await operator.database.rpc("admin_claim_action",{claim_id_input:claimId,action_input:"PROPOSE_RESOLUTION",note_input:"ซ่อมมุมและตรวจคุณภาพก่อนส่งคืน",responsibility_input:null,resolution_type_input:"REPAIR",evidence_file_id_input:null,assigned_to_input:null,target_resolution_at_input:new Date(Date.now()+86400000*7).toISOString()}),"propose repair");
must(await operator.database.rpc("admin_claim_action",{claim_id_input:claimId,action_input:"MARK_IN_PROGRESS",note_input:"ส่งเข้าทีมซ่อม",responsibility_input:null,resolution_type_input:null,evidence_file_id_input:null,assigned_to_input:null,target_resolution_at_input:null}),"mark in progress");
must(await operator.database.rpc("admin_claim_action",{claim_id_input:claimId,action_input:"COMPLETE_RESOLUTION",note_input:"ซ่อมและตรวจงานเรียบร้อย",responsibility_input:null,resolution_type_input:null,evidence_file_id_input:resolutionEvidence,assigned_to_input:null,target_resolution_at_input:null}),"complete resolution");
const prematureClose=await operator.database.rpc("admin_claim_action",{claim_id_input:claimId,action_input:"CLOSE",note_input:"ปิดก่อนสมาชิกยืนยัน",responsibility_input:null,resolution_type_input:null,evidence_file_id_input:null,assigned_to_input:null,target_resolution_at_input:null});
assert(Boolean(prematureClose.error),"claim cannot close before member confirmation");
must(await member.database.rpc("member_claim_action",{claim_id_input:claimId,action_input:"CONFIRM_RESOLVED",note_input:"ตรวจรับแล้ว",evidence_file_id_input:null}),"member confirms resolution");
must(await operator.database.rpc("record_claim_internal_cost",{claim_id_input:claimId,cost_type_input:"ค่าซ่อม",amount_input:1250,currency_input:"THB",internal_note_input:"ข้อมูลภายในห้ามแสดง Member"}),"record internal cost");
const hiddenCosts=must(await member.database.from("claim_internal_costs").select("id,amount").eq("claim_id",claimId),"member internal cost visibility");
assert(hiddenCosts.length===0,"member cannot read internal claim costs");
must(await operator.database.rpc("admin_claim_action",{claim_id_input:claimId,action_input:"CLOSE",note_input:"ตรวจทานผลครบถ้วน",responsibility_input:null,resolution_type_input:null,evidence_file_id_input:null,assigned_to_input:null,target_resolution_at_input:null}),"close claim");
const finalClaim=must(await admin.database.from("claims").select("status,member_confirmed_at,closed_at").eq("id",claimId).single(),"read final claim");
assert(finalClaim.status==="CLOSED"&&finalClaim.member_confirmed_at&&finalClaim.closed_at,"claim closes with all required evidence and confirmation");
const events=must(await member.database.from("claim_events").select("action,is_member_visible").eq("claim_id",claimId),"member claim timeline");
assert(events.length>=8&&!events.some((event)=>event.action==="INTERNAL_COST_RECORDED"),"member timeline excludes internal cost event");
for(const line of results)console.log(line);
console.log(`Slice 9 branch integration complete: ${results.length} assertions`);
console.log(`Automated claim: ${claimId}`);

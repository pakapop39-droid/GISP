import { createAdminClient, createClient } from "@insforge/sdk";
import { getUatPassword, UAT_ADMIN_EMAIL, UAT_MEMBER_EMAIL } from "./uat-password.mjs";

const baseUrl=process.env.INSFORGE_URL,apiKey=process.env.INSFORGE_API_KEY,anonKey=process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
if(!baseUrl||!apiKey||!anonKey)throw new Error("Slice 8 branch test environment is incomplete");
const isSlice8Branch=baseUrl.includes("kit6y4pj-gug");
const isApprovedDevelopment=baseUrl === "https://kit6y4pj.ap-southeast.insforge.app"
  && process.env.ALLOW_DEVELOPMENT_TARGET === "true";
if(!isSlice8Branch&&!isApprovedDevelopment)throw new Error("Refusing to test outside Slice 8 branch or explicitly approved Development backend");
const admin=createAdminClient({baseUrl,apiKey}),password=getUatPassword(),runId=Date.now(),results=[];
const assert=(value,label)=>{if(!value)throw new Error(`FAILED: ${label}`);results.push(`PASS: ${label}`)};
const must=(result,label)=>{if(result.error)throw new Error(`${label}: ${result.error.message}`);return result.data};
async function signIn(email){const client=createClient({baseUrl,anonKey});must(await client.auth.signInWithPassword({email,password}),`sign in ${email}`);return client}
const operator=await signIn(UAT_ADMIN_EMAIL),member=await signIn(UAT_MEMBER_EMAIL);
const operatorUser=must(await operator.auth.getCurrentUser(),"operator user").user;
const memberUser=must(await member.auth.getCurrentUser(),"member user").user;
const profile=must(await admin.database.from("member_profiles").select("id,user_id,organization_id").eq("user_id",memberUser.id).single(),"member profile");
const supplier=must(await admin.database.from("suppliers").select("id").eq("status","ACTIVE").limit(1).single(),"active supplier");

const project=must(await admin.database.from("projects").insert([{
  organization_id:profile.organization_id,member_profile_id:profile.id,project_number:`PRJ-S8-${runId}`,
  name:`Slice 8 Shipment Delivery ${runId}`,site_address:"Bangkok Slice 8 UAT",status:"ACTIVE",created_by:memberUser.id,
}]).select("id,project_number,name").single(),"create project");
const projectItem=must(await admin.database.from("project_items").insert([{
  project_id:project.id,organization_id:profile.organization_id,item_type:"STANDARD",item_name:"โต๊ะทดสอบ Slice 8",
  specification_snapshot:"โต๊ะ 2 ตัว",selected_options:[],quantity:2,unit:"EA",current_unit_price:50000,
  vat_rate_snapshot:7,status:"ORDERED",ordered_quantity:2,created_by:memberUser.id,
}]).select("id,item_name").single(),"create project item");
const order=must(await admin.database.from("customer_orders").insert([{
  organization_id:profile.organization_id,member_profile_id:profile.id,project_id:project.id,
  order_number:`ORD-S8-${runId}`,status:"READY_TO_SHIP",currency:"THB",subtotal:100000,vat_rate_snapshot:7,
  vat_amount:7000,grand_total:107000,deposit_amount:53500,balance_amount:53500,
  deposit_verified_at:new Date().toISOString(),balance_verified_at:new Date().toISOString(),
  shipping_address_snapshot:{site_address:"Bangkok Slice 8 UAT"},created_by:memberUser.id,
}]).select("id,order_number").single(),"create order");
const orderItem=must(await admin.database.from("order_items").insert([{
  order_id:order.id,organization_id:profile.organization_id,project_item_id:projectItem.id,item_type:"STANDARD",
  item_name_snapshot:projectItem.item_name,specification_snapshot:"โต๊ะ 2 ตัว",options_snapshot:[],quantity:2,
  unit:"EA",unit_price_snapshot:50000,line_subtotal:100000,vat_rate_snapshot:7,vat_amount:7000,
  line_total:107000,qc_status:"PASSED",
}]).select("id").single(),"create order item");
const supplierOrder=must(await admin.database.from("supplier_orders").insert([{
  customer_order_id:order.id,organization_id:profile.organization_id,supplier_id:supplier.id,
  supplier_order_number:`SO-S8-${runId}`,po_number:`PO-S8-${runId}`,status:"PRODUCTION_COMPLETED",
  supplier_currency:"CNY",total_factory_cost:60000,paid_factory_amount:60000,
  supplier_balance_paid_at:new Date().toISOString(),po_issued_at:new Date().toISOString(),
}]).select("id").single(),"create supplier order");
const supplierItem=must(await admin.database.from("supplier_order_items").insert([{
  supplier_order_id:supplierOrder.id,order_item_id:orderItem.id,quantity:2,
  factory_unit_cost_snapshot:30000,factory_line_total:60000,
}]).select("id").single(),"create supplier item");
must(await admin.database.from("payment_schedules").insert([{
  order_id:order.id,organization_id:profile.organization_id,schedule_type:"DEPOSIT",due_amount:53500,
  verified_amount:53500,status:"VERIFIED",verified_at:new Date().toISOString(),
},{
  order_id:order.id,organization_id:profile.organization_id,schedule_type:"BALANCE",due_amount:53500,
  verified_amount:53500,status:"VERIFIED",verified_at:new Date().toISOString(),
}]),"create paid order schedules");
const warehouse=must(await admin.database.from("warehouses").insert([{
  warehouse_code:`CN-S8-${runId}`,warehouse_name:"Slice 8 China Warehouse",country_code:"CN",
  address:{city:"Foshan"},created_by:operatorUser.id,
}]).select("id").single(),"create warehouse");

const overReceipt=await operator.database.rpc("create_warehouse_receipt",{
  supplier_order_id_input:supplierOrder.id,warehouse_id_input:warehouse.id,received_at_input:new Date().toISOString(),
  package_count_input:1,actual_weight_kg_input:10,actual_cbm_input:1,note_input:null,
  items_input:[{supplier_order_item_id:supplierItem.id,received_quantity:3,condition:"GOOD",blocked_quantity:0}],evidence_file_ids_input:[],
});
assert(Boolean(overReceipt.error),"warehouse receipt cannot exceed supplier quantity");
const receiptId=must(await operator.database.rpc("create_warehouse_receipt",{
  supplier_order_id_input:supplierOrder.id,warehouse_id_input:warehouse.id,received_at_input:new Date().toISOString(),
  package_count_input:2,actual_weight_kg_input:40,actual_cbm_input:1.2,note_input:"รับครบ 2 ตัว",
  items_input:[{supplier_order_item_id:supplierItem.id,received_quantity:2,condition:"GOOD",blocked_quantity:0}],evidence_file_ids_input:[],
}),"create warehouse receipt");
const receiptItem=must(await admin.database.from("warehouse_receipt_items").select("id").eq("warehouse_receipt_id",receiptId).single(),"read receipt item");
const overRelease=await operator.database.rpc("release_warehouse_receipt_item",{warehouse_receipt_item_id_input:receiptItem.id,release_quantity_input:3});
assert(Boolean(overRelease.error),"release cannot exceed received quantity");
must(await operator.database.rpc("release_warehouse_receipt_item",{warehouse_receipt_item_id_input:receiptItem.id,release_quantity_input:2}),"release receipt item");
const memberReceiptRows=must(await member.database.from("warehouse_receipts").select("id").eq("id",receiptId),"member receipt visibility check");
assert(memberReceiptRows.length===0,"member cannot read internal warehouse receipt detail");

const overConsolidation=await operator.database.rpc("create_consolidation",{
  customer_order_id_input:order.id,warehouse_id_input:warehouse.id,strategy_input:"PARTIAL",reason_input:"ทดสอบเกินยอด",
  items_input:[{warehouse_receipt_item_id:receiptItem.id,quantity:3}],
});
assert(Boolean(overConsolidation.error),"consolidation cannot exceed released quantity");
const consolidationId=must(await operator.database.rpc("create_consolidation",{
  customer_order_id_input:order.id,warehouse_id_input:warehouse.id,strategy_input:"PARTIAL",reason_input:"ส่งทันกำหนดไซต์งาน",
  items_input:[{warehouse_receipt_item_id:receiptItem.id,quantity:2}],
}),"create consolidation");
must(await operator.database.rpc("confirm_consolidation",{consolidation_id_input:consolidationId}),"confirm consolidation");
const shipmentId=must(await operator.database.rpc("create_shipment_v2",{
  consolidation_id_input:consolidationId,shipment_name_input:"Slice 8 Test Shipment",shipping_method_input:"LCL",
  tracking_number_input:`TRK-S8-${runId}`,etd_at_input:new Date().toISOString(),
  eta_at_input:new Date(Date.now()+86400000*14).toISOString(),remaining_plan_input:"เที่ยวนี้มีสินค้าครบ แต่คิดค่าจัดการ Partial",
  additional_member_charge_input:500,charge_bearer_input:"MEMBER",
}),"create partial shipment");
const blockedDispatch=await operator.database.rpc("dispatch_shipment",{shipment_id_input:shipmentId});
assert(Boolean(blockedDispatch.error),"partial shipment with member charge waits for acknowledgement");
const visiblePartialDecision=must(await member.database.from("partial_shipment_decisions")
  .select("reason,additional_member_charge,member_acknowledgement_required,member_acknowledged_at")
  .eq("shipment_id",shipmentId).single(),"member reads partial shipment decision");
assert(visiblePartialDecision.reason==="ส่งทันกำหนดไซต์งาน"&&Number(visiblePartialDecision.additional_member_charge)===500,"member sees partial reason and additional charge");
must(await member.database.rpc("acknowledge_partial_shipment",{shipment_id_input:shipmentId,note_input:"รับทราบค่าใช้จ่าย"}),"member acknowledges partial charge");
must(await operator.database.rpc("dispatch_shipment",{shipment_id_input:shipmentId}),"dispatch shipment");
must(await operator.database.rpc("add_shipment_event",{
  shipment_id_input:shipmentId,status_input:"DEPARTED_CHINA",event_at_input:new Date().toISOString(),
  location_input:"Foshan",note_input:"ออกจากจีน",eta_at_input:null,is_member_visible_input:true,evidence_file_id_input:null,
}),"record departure");
const duplicateDeparture=await operator.database.rpc("add_shipment_event",{
  shipment_id_input:shipmentId,status_input:"DEPARTED_CHINA",event_at_input:new Date().toISOString(),
  location_input:"Foshan",note_input:"สถานะหลักซ้ำ",eta_at_input:null,is_member_visible_input:true,evidence_file_id_input:null,
});
assert(Boolean(duplicateDeparture.error),"tracking milestone cannot be recorded twice");
const backwardsEvent=await operator.database.rpc("add_shipment_event",{
  shipment_id_input:shipmentId,status_input:"BOOKED",event_at_input:new Date().toISOString(),
  location_input:"Foshan",note_input:"ย้อนสถานะ",eta_at_input:null,is_member_visible_input:true,evidence_file_id_input:null,
});
assert(Boolean(backwardsEvent.error),"tracking milestone cannot move backward");
for(const status of ["ARRIVED_THAILAND","IMPORT_CUSTOMS","THAILAND_WAREHOUSE","READY_FOR_DELIVERY"]){
  must(await operator.database.rpc("add_shipment_event",{
    shipment_id_input:shipmentId,status_input:status,event_at_input:new Date().toISOString(),
    location_input:"Thailand",note_input:status,eta_at_input:null,is_member_visible_input:true,evidence_file_id_input:null,
  }),`tracking ${status}`);
}

const proofKey=`slice8-test/${runId}-proof.png`,proofBytes=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64");
const proofUpload=must(await admin.storage.from("gisp-member-private").upload(proofKey,new File([proofBytes],"slice8-proof.png",{type:"image/png"})),"upload POD evidence");
const proofFile=must(await admin.database.from("file_metadata").insert([{
  organization_id:profile.organization_id,member_profile_id:profile.id,bucket:"gisp-member-private",object_key:proofKey,
  url:proofUpload.url,original_name:"slice8-proof.png",mime_type:"image/png",size_bytes:proofBytes.length,
  visibility:"MEMBER_PRIVATE",entity_type:"DELIVERY_EVIDENCE",entity_id:shipmentId,uploaded_by:operatorUser.id,
}]).select("id").single(),"create POD metadata");
let deliveryId=must(await operator.database.rpc("schedule_delivery",{
  shipment_id_input:shipmentId,scheduled_at_input:new Date(Date.now()+86400000).toISOString(),
  scheduled_window_end_input:new Date(Date.now()+86400000+3600000).toISOString(),
  contact_name_input:"UAT Member",contact_phone_input:"0800000000",site_note_input:"โทรก่อนถึง",
}),"schedule first delivery");
must(await member.database.rpc("confirm_delivery_appointment",{delivery_id_input:deliveryId}),"member confirms first delivery");
must(await operator.database.rpc("advance_delivery_status",{delivery_id_input:deliveryId,target_status_input:"OUT_FOR_DELIVERY",reason_input:null,driver_name_input:"Driver 1",driver_phone_input:"0811111111",vehicle_registration_input:"TEST-1"}),"first delivery out");
const shipmentItem=must(await admin.database.from("shipment_items").select("id").eq("shipment_id",shipmentId).single(),"read shipment item");
const noNextPlan=await operator.database.rpc("record_delivery_v2",{
  delivery_id_input:deliveryId,delivered_at_input:new Date().toISOString(),recipient_name_input:"UAT Member",recipient_phone_input:"0800000000",
  items_input:[{shipment_item_id:shipmentItem.id,quantity_delivered:1,condition:"GOOD"}],evidence_file_ids_input:[proofFile.id],next_delivery_plan_input:null,note_input:null,
});
assert(Boolean(noNextPlan.error),"partial delivery requires next delivery plan");
must(await operator.database.rpc("record_delivery_v2",{
  delivery_id_input:deliveryId,delivered_at_input:new Date().toISOString(),recipient_name_input:"UAT Member",recipient_phone_input:"0800000000",
  items_input:[{shipment_item_id:shipmentItem.id,quantity_delivered:1,condition:"GOOD"}],evidence_file_ids_input:[proofFile.id],
  next_delivery_plan_input:"ส่งอีก 1 ตัวตามนัดใหม่",note_input:"ส่งครั้งแรก",
}),"record partial delivery");

deliveryId=must(await operator.database.rpc("schedule_delivery",{
  shipment_id_input:shipmentId,scheduled_at_input:new Date(Date.now()+86400000*2).toISOString(),
  scheduled_window_end_input:new Date(Date.now()+86400000*2+3600000).toISOString(),
  contact_name_input:"UAT Member",contact_phone_input:"0800000000",site_note_input:null,
}),"schedule second delivery");
const rescheduleId=must(await member.database.rpc("request_delivery_reschedule",{
  delivery_id_input:deliveryId,preferred_dates_input:[new Date(Date.now()+86400000*3).toISOString()],reason_input:"ไซต์ปิดชั่วคราว",
  contact_name_input:"UAT Member",contact_phone_input:"0800000000",site_note_input:"เข้าประตู 2",requested_address_input:null,
}),"member requests reschedule");
must(await operator.database.rpc("review_delivery_reschedule",{
  request_id_input:rescheduleId,approve_input:true,decision_note_input:"ยืนยันวันใหม่",
  accepted_scheduled_at_input:new Date(Date.now()+86400000*3).toISOString(),
  accepted_window_end_input:new Date(Date.now()+86400000*3+3600000).toISOString(),
}),"approve reschedule");
must(await operator.database.rpc("advance_delivery_status",{delivery_id_input:deliveryId,target_status_input:"OUT_FOR_DELIVERY",reason_input:null,driver_name_input:"Driver 2",driver_phone_input:"0822222222",vehicle_registration_input:"TEST-2"}),"second delivery out");
must(await operator.database.rpc("record_delivery_v2",{
  delivery_id_input:deliveryId,delivered_at_input:new Date().toISOString(),recipient_name_input:"UAT Member",recipient_phone_input:"0800000000",
  items_input:[{shipment_item_id:shipmentItem.id,quantity_delivered:1,condition:"GOOD"}],evidence_file_ids_input:[proofFile.id],next_delivery_plan_input:null,note_input:"ส่งครบ",
}),"record final delivery");

must(await operator.database.rpc("add_logistics_cost",{
  customer_order_id_input:order.id,shipment_id_input:shipmentId,delivery_id_input:deliveryId,
  category_input:"INTERNATIONAL_FREIGHT",description_input:"ค่าขนส่งระหว่างประเทศ",supplier_cost_input:8000,
  supplier_currency_input:"THB",exchange_rate_input:1,member_charge_input:10000,is_billable_input:true,
  internal_note_input:"ต้นทุนภายในห้ามแสดง Member",member_visible_note_input:"ค่าขนส่งระหว่างประเทศ",evidence_file_ids_input:[],
}),"add actual logistics cost");
const earlyInvoice=await operator.database.rpc("issue_freight_invoice",{customer_order_id_input:order.id,vat_rate_input:7,due_at_input:null,note_input:null});
assert(Boolean(earlyInvoice.error),"freight invoice cannot be issued before cost finalization");
must(await operator.database.rpc("finalize_logistics_costs",{customer_order_id_input:order.id}),"finalize logistics costs");
const invoiceId=must(await operator.database.rpc("issue_freight_invoice",{customer_order_id_input:order.id,vat_rate_input:7,due_at_input:new Date(Date.now()+86400000*7).toISOString(),note_input:"Slice 8 UAT"}),"issue freight invoice");
const invoice=must(await member.database.from("freight_invoices").select("id,payment_schedule_id,grand_total,status").eq("id",invoiceId).single(),"member reads freight invoice");
const hiddenCost=must(await member.database.from("logistics_cost_items").select("id,supplier_cost").eq("customer_order_id",order.id),"member internal cost visibility check");
assert(hiddenCost.length===0,"member cannot read supplier/internal logistics cost");
const transferId=must(await member.database.rpc("submit_payment_transfer",{
  payment_schedule_id_input:invoice.payment_schedule_id,amount_input:invoice.grand_total,
  transferred_at_input:new Date().toISOString(),evidence_file_id_input:proofFile.id,
}),"submit freight payment slip");
must(await operator.database.rpc("verify_payment_transfer",{transfer_id_input:transferId,approve_input:true,finance_note_input:"ยอดถูกต้อง"}),"finance verifies freight payment");
const finalOrder=must(await admin.database.from("customer_orders").select("status").eq("id",order.id).single(),"read final order");
const finalInvoice=must(await admin.database.from("freight_invoices").select("status").eq("id",invoiceId).single(),"read final invoice");
assert(finalOrder.status==="COMPLETED"&&finalInvoice.status==="PAID","full delivery plus verified freight completes order");

for(const line of results)console.log(line);
console.log(`Slice 8 branch integration complete: ${results.length} assertions`);
console.log(`UAT project: ${project.project_number} — ${project.name}`);
console.log(`UAT order: ${order.order_number}`);

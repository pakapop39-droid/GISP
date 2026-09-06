import { createAdminClient, createClient } from "@insforge/sdk";
import { getUatPassword, UAT_ADMIN_EMAIL, UAT_MEMBER_EMAIL } from "./uat-password.mjs";

const baseUrl=process.env.INSFORGE_URL,apiKey=process.env.INSFORGE_API_KEY,anonKey=process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
if(!baseUrl||!apiKey||!anonKey)throw new Error("Slice 8 fixture environment is incomplete");
if(!baseUrl.includes("kit6y4pj-gug"))throw new Error("Refusing to seed outside Slice 8 backend branch");
const admin=createAdminClient({baseUrl,apiKey}),password=getUatPassword(),suffix=Date.now();
const must=(result,label)=>{if(result.error)throw new Error(`${label}: ${result.error.message}`);return result.data};
async function signIn(email){const client=createClient({baseUrl,anonKey});must(await client.auth.signInWithPassword({email,password}),`sign in ${email}`);return client}
const operator=await signIn(UAT_ADMIN_EMAIL),member=await signIn(UAT_MEMBER_EMAIL);
const operatorUser=must(await operator.auth.getCurrentUser(),"operator user").user;
const memberUser=must(await member.auth.getCurrentUser(),"member user").user;
const profile=must(await admin.database.from("member_profiles").select("id,user_id,organization_id").eq("user_id",memberUser.id).single(),"member profile");
const supplier=must(await admin.database.from("suppliers").select("id").eq("status","ACTIVE").limit(1).single(),"active supplier");
const project=must(await admin.database.from("projects").insert([{
  organization_id:profile.organization_id,member_profile_id:profile.id,project_number:`PRJ-S8-HUAT-${suffix}`,
  name:`Slice 8 Human UAT ${suffix}`,site_address:"Bangkok — Slice 8 Human UAT",status:"ACTIVE",created_by:memberUser.id,
}]).select("id,project_number,name").single(),"project");
const projectItem=must(await admin.database.from("project_items").insert([{
  project_id:project.id,organization_id:profile.organization_id,item_type:"STANDARD",item_name:"โต๊ะรับรอง Slice 8 Human UAT",
  specification_snapshot:"โต๊ะไม้โอ๊ก 2 ตัว",selected_options:[],quantity:2,unit:"EA",current_unit_price:50000,
  vat_rate_snapshot:7,status:"ORDERED",ordered_quantity:2,created_by:memberUser.id,
}]).select("id,item_name").single(),"project item");
const order=must(await admin.database.from("customer_orders").insert([{
  organization_id:profile.organization_id,member_profile_id:profile.id,project_id:project.id,
  order_number:`ORD-S8-HUAT-${suffix}`,status:"READY_TO_SHIP",currency:"THB",subtotal:100000,vat_rate_snapshot:7,
  vat_amount:7000,grand_total:107000,deposit_amount:53500,balance_amount:53500,
  deposit_verified_at:new Date().toISOString(),balance_verified_at:new Date().toISOString(),
  shipping_address_snapshot:{site_address:"Bangkok — Slice 8 Human UAT"},created_by:memberUser.id,
}]).select("id,order_number").single(),"order");
const orderItem=must(await admin.database.from("order_items").insert([{
  order_id:order.id,organization_id:profile.organization_id,project_item_id:projectItem.id,item_type:"STANDARD",
  item_name_snapshot:projectItem.item_name,specification_snapshot:"โต๊ะไม้โอ๊ก 2 ตัว",options_snapshot:[],quantity:2,
  unit:"EA",unit_price_snapshot:50000,line_subtotal:100000,vat_rate_snapshot:7,vat_amount:7000,line_total:107000,qc_status:"PASSED",
}]).select("id").single(),"order item");
const supplierOrder=must(await admin.database.from("supplier_orders").insert([{
  customer_order_id:order.id,organization_id:profile.organization_id,supplier_id:supplier.id,
  supplier_order_number:`SO-S8-HUAT-${suffix}`,po_number:`PO-S8-HUAT-${suffix}`,status:"PRODUCTION_COMPLETED",
  supplier_currency:"CNY",total_factory_cost:60000,paid_factory_amount:60000,
  supplier_balance_paid_at:new Date().toISOString(),po_issued_at:new Date().toISOString(),
}]).select("id").single(),"supplier order");
const supplierItem=must(await admin.database.from("supplier_order_items").insert([{
  supplier_order_id:supplierOrder.id,order_item_id:orderItem.id,quantity:2,factory_unit_cost_snapshot:30000,factory_line_total:60000,
}]).select("id").single(),"supplier item");
must(await admin.database.from("payment_schedules").insert([{
  order_id:order.id,organization_id:profile.organization_id,schedule_type:"DEPOSIT",due_amount:53500,verified_amount:53500,status:"VERIFIED",verified_at:new Date().toISOString(),
},{order_id:order.id,organization_id:profile.organization_id,schedule_type:"BALANCE",due_amount:53500,verified_amount:53500,status:"VERIFIED",verified_at:new Date().toISOString()}]),"payment schedules");
const warehouse=must(await admin.database.from("warehouses").insert([{
  warehouse_code:`CN-HUAT-${suffix}`,warehouse_name:"China Warehouse — Human UAT",country_code:"CN",address:{city:"Foshan"},created_by:operatorUser.id,
}]).select("id").single(),"warehouse");
const receiptId=must(await operator.database.rpc("create_warehouse_receipt",{
  supplier_order_id_input:supplierOrder.id,warehouse_id_input:warehouse.id,received_at_input:new Date().toISOString(),
  package_count_input:2,actual_weight_kg_input:40,actual_cbm_input:1.2,note_input:"รับสินค้าครบสำหรับ Human UAT",
  items_input:[{supplier_order_item_id:supplierItem.id,received_quantity:2,condition:"GOOD",blocked_quantity:0}],evidence_file_ids_input:[],
}),"warehouse receipt");
const receiptItem=must(await admin.database.from("warehouse_receipt_items").select("id").eq("warehouse_receipt_id",receiptId).single(),"receipt item");
must(await operator.database.rpc("release_warehouse_receipt_item",{warehouse_receipt_item_id_input:receiptItem.id,release_quantity_input:2}),"release item");
const consolidationId=must(await operator.database.rpc("create_consolidation",{
  customer_order_id_input:order.id,warehouse_id_input:warehouse.id,strategy_input:"PARTIAL",
  reason_input:"Human UAT: ทดสอบ Member acknowledgement และนัดส่ง",items_input:[{warehouse_receipt_item_id:receiptItem.id,quantity:2}],
}),"consolidation");
must(await operator.database.rpc("confirm_consolidation",{consolidation_id_input:consolidationId}),"confirm consolidation");
console.log(JSON.stringify({projectNumber:project.project_number,projectName:project.name,orderId:order.id,orderNumber:order.order_number,adminUrl:`http://localhost:3000/admin/orders/${order.id}`,memberUrl:`http://localhost:3000/member/orders/${order.id}`},null,2));

import { createAdminClient, createClient } from "@insforge/sdk";
import { getUatPassword, UAT_MEMBER_EMAIL } from "./uat-password.mjs";

const baseUrl=process.env.INSFORGE_URL,apiKey=process.env.INSFORGE_API_KEY,anonKey=process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
if(!baseUrl||!apiKey||!anonKey)throw new Error("Slice 9 fixture environment is incomplete");
if(!baseUrl.includes("kit6y4pj-hur"))throw new Error("Refusing to seed outside Slice 9 backend branch");
const admin=createAdminClient({baseUrl,apiKey}),password=getUatPassword(),suffix=Date.now();
const must=(result,label)=>{if(result.error)throw new Error(`${label}: ${result.error.message}`);return result.data};
const member=createClient({baseUrl,anonKey});must(await member.auth.signInWithPassword({email:UAT_MEMBER_EMAIL,password}),"sign in UAT member");
const memberUser=must(await member.auth.getCurrentUser(),"member user").user;
const profile=must(await admin.database.from("member_profiles").select("id,organization_id").eq("user_id",memberUser.id).single(),"member profile");
const order=must(await admin.database.from("customer_orders").select("id,project_id,organization_id,order_number").eq("member_profile_id",profile.id).order("created_at",{ascending:false}).limit(1).single(),"member order");
const delivery=must(await admin.database.from("deliveries").select("id,status").eq("customer_order_id",order.id).in("status",["DELIVERED","DELIVERED_WITH_ISSUE"]).limit(1).single(),"delivered order");
const projectItem=must(await admin.database.from("project_items").insert([{
  project_id:order.project_id,organization_id:profile.organization_id,item_type:"STANDARD",item_name:`ตู้ข้างเตียง Slice 9 Human UAT ${suffix}`,
  specification_snapshot:"ตู้ไม้โอ๊ก 2 ตัว — รายการเฉพาะสำหรับทดสอบ Claim",selected_options:[],quantity:2,unit:"EA",current_unit_price:15000,
  vat_rate_snapshot:7,status:"ORDERED",ordered_quantity:2,created_by:memberUser.id,
}]).select("id,item_name").single(),"UAT project item");
const orderItem=must(await admin.database.from("order_items").insert([{
  order_id:order.id,organization_id:profile.organization_id,project_item_id:projectItem.id,item_type:"STANDARD",item_name_snapshot:projectItem.item_name,
  specification_snapshot:"ตู้ไม้โอ๊ก 2 ตัว",options_snapshot:[],quantity:2,unit:"EA",unit_price_snapshot:15000,line_subtotal:30000,
  vat_rate_snapshot:7,vat_amount:2100,line_total:32100,qc_status:"PASSED",
}]).select("id").single(),"UAT order item");
const deliveredItem=must(await admin.database.from("delivery_items").insert([{
  delivery_id:delivery.id,organization_id:profile.organization_id,order_item_id:orderItem.id,quantity_delivered:2,expected_quantity:2,
  remaining_quantity:0,condition:"GOOD",note:"Slice 9 Human UAT — พร้อมเปิด Claim",
}]).select("id").single(),"UAT delivered item");
console.log(JSON.stringify({
  itemName:projectItem.item_name,deliveredQuantity:2,deliveryItemId:deliveredItem.id,
  memberUrl:"/member/claims/new",adminUrl:"/admin/claims",
  note:"Fixture พร้อมสำหรับ Human UAT; ยังไม่ได้เปิด Claim แทนผู้ใช้"
},null,2));

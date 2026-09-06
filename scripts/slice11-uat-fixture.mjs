import { createAdminClient, createClient } from "@insforge/sdk";
import { getUatPassword, UAT_ADMIN_EMAIL, UAT_MEMBER_EMAIL } from "./uat-password.mjs";

const baseUrl = process.env.INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
if (!baseUrl || !apiKey || !anonKey) throw new Error("Slice 11 fixture environment is incomplete");
if (!baseUrl.includes("kit6y4pj-tvr")) throw new Error("Refusing to seed outside Slice 11 backend branch");
const admin = createAdminClient({baseUrl,apiKey});
const password = getUatPassword();
const suffix = Date.now();
const must = (result,label) => { if(result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; };
async function signIn(email){const client=createClient({baseUrl,anonKey});must(await client.auth.signInWithPassword({email,password}),`sign in ${email}`);return client;}
const operator = await signIn(UAT_ADMIN_EMAIL);
await signIn(UAT_MEMBER_EMAIL);
const operatorUser = must(await operator.auth.getCurrentUser(),"operator user").user;
const supplier = must(await admin.database.from("suppliers").select("id,code,name,country_code").eq("status","ACTIVE").limit(1).single(),"active supplier");
let category = must(await admin.database.from("categories").select("id").eq("status","ACTIVE").limit(1),"active category")[0];
if(!category) category=must(await admin.database.from("categories").insert([{code:`S11-${suffix}`,name_th:"ตัวอย่างสินค้า Slice 11",status:"ACTIVE"}]).select("id").single(),"create category");

async function createProduct(type,name,skuSuffix,price){
  const product=must(await admin.database.from("products").insert([{
    supplier_id:supplier.id,category_id:category.id,sku:`S11-${skuSuffix}-${suffix}`,product_type:type,
    name_th:name,name_en:`Slice 11 ${type} UAT`,description_th:"สินค้าสำหรับทดสอบตัวอย่างและเงื่อนไขรับประกัน",
    specification_summary:"ข้อมูลทดสอบ Human UAT",default_lead_time_days:30,country_code:supplier.country_code||"CN",
    material_summary:"วัสดุตัวอย่าง Slice 11",finish_summary:"ผิวสำเร็จสำหรับ UAT",moq:1,
    factory_cost:10000,factory_currency:"CNY",status:"PUBLISHED",qa_status:"PASSED",
    reviewed_by:operatorUser.id,reviewed_at:new Date().toISOString(),published_at:new Date().toISOString(),created_by:operatorUser.id,
  }]).select("id,sku,name_th").single(),`create ${type} product`);
  must(await admin.database.from("product_prices").insert([{product_id:product.id,price_type:"MEMBER",amount:price,suggested_resale_amount:price*1.2,freight_estimate_min:2500,freight_estimate_max:4500,currency:"THB",status:"ACTIVE",valid_from:new Date().toISOString(),created_by:operatorUser.id}]),`price ${type}`);
  return product;
}
const materialProduct=await createProduct("MATERIAL","ผ้าบุโทนทราย — Slice 11 UAT","MAT",25000);
const builtInProduct=await createProduct("BUILT_IN","ชุดครัว Built-in — Slice 11 UAT","BIN",180000);
const locationId=must(await operator.database.rpc("create_supplier_sample_location",{supplier_id_input:supplier.id,country_code_input:"TH",city_input:"กรุงเทพฯ",location_type_input:"SHOWROOM",public_label_input:"โชว์รูม GISP กรุงเทพฯ",address_line_input:"99 ถนนทดสอบ (ข้อมูลภายใน)",contact_name_input:"ผู้ดูแล UAT",contact_email_input:"internal-s11@gisp.example.com",contact_phone_input:"0800000011"}),"create sample location");
const swatchId=must(await operator.database.rpc("create_material_sample",{product_id_input:materialProduct.id,supplier_location_id_input:locationId,sample_code_input:`SMP-S11-MAT-${suffix}`,sample_type_input:"MATERIAL_SWATCH",display_name_input:"ผ้าบุโทนทราย",member_note_input:"กรุณานัดหมายล่วงหน้าก่อนเข้าชม",shelf_location_input:"A-11",internal_note_input:"สำรองสำหรับ Human UAT เท่านั้น"}),"create material swatch");
const builtInId=must(await operator.database.rpc("create_material_sample",{product_id_input:builtInProduct.id,supplier_location_id_input:locationId,sample_code_input:`SMP-S11-BIN-${suffix}`,sample_type_input:"BUILT_IN_DISPLAY",display_name_input:"ชุดครัว Built-in สีโอ๊ก",member_note_input:"เข้าชมได้ที่โชว์รูมตามเวลาทำการ",shelf_location_input:"DISPLAY-11",internal_note_input:"ห้ามย้ายชุดแสดงโดยไม่แจ้งคลัง"}),"create built-in display");
const warrantyV1=must(await operator.database.rpc("create_partner_warranty_draft",{supplier_id_input:supplier.id,product_id_input:builtInProduct.id,title_input:"รับประกันชุด Built-in 24 เดือน",member_summary_input:"รับประกันโครงสร้างและอุปกรณ์มาตรฐาน 24 เดือนนับจากวันส่งมอบ",terms_text_input:"ครอบคลุมความเสียหายจากการผลิตตามการตรวจสอบของทีม GISP ไม่ครอบคลุมการใช้งานผิดประเภทหรือการแก้ไขโดยบุคคลภายนอก",duration_months_input:24,effective_from_input:new Date(Date.now()-60_000).toISOString()}),"create warranty v1");
must(await operator.database.rpc("activate_partner_warranty_version",{warranty_id_input:warrantyV1}),"activate warranty v1");
const warrantyV2=must(await operator.database.rpc("create_partner_warranty_draft",{supplier_id_input:supplier.id,product_id_input:builtInProduct.id,title_input:"รับประกันชุด Built-in 36 เดือน — ฉบับรออนุมัติ",member_summary_input:"ขยายระยะรับประกันโครงสร้างเป็น 36 เดือน",terms_text_input:"ฉบับร่างสำหรับทดสอบ Activate: ครอบคลุมโครงสร้าง 36 เดือน อุปกรณ์มาตรฐาน 24 เดือน ตามผลการตรวจสอบ",duration_months_input:36,effective_from_input:new Date(Date.now()-30_000).toISOString()}),"create warranty v2 draft");
console.log(JSON.stringify({branch:"slice-11-samples-warranty",supplier,locationId,materialProduct,builtInProduct,swatchId,builtInId,warrantyV1,warrantyV2,adminEmail:UAT_ADMIN_EMAIL,memberEmail:UAT_MEMBER_EMAIL},null,2));

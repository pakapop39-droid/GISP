import { createAdminClient } from "@insforge/sdk";
import { getUatPassword, UAT_ADMIN_EMAIL, UAT_MEMBER_EMAIL } from "./uat-password.mjs";

const previewUrl = process.env.SLICE11_PREVIEW_URL ?? "https://kit6y4pj-tvr.insforge.site";
const baseUrl = process.env.INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
if (!previewUrl.includes("kit6y4pj-tvr") || !baseUrl?.includes("kit6y4pj-tvr") || !apiKey) {
  throw new Error("Refusing to smoke test outside Slice 11 preview");
}
const password = getUatPassword();
const admin = createAdminClient({baseUrl,apiKey});
const productResult = await admin.database.from("products").select("id,sku").like("sku","S11-BIN-%").order("created_at",{ascending:false}).limit(1).single();
if(productResult.error) throw new Error(`load UAT product: ${productResult.error.message}`);

async function login(email){
  const response=await fetch(`${previewUrl}/api/auth/sign-in`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password}),redirect:"manual"});
  if(!response.ok) throw new Error(`login ${email}: HTTP ${response.status} ${await response.text()}`);
  const cookies=response.headers.getSetCookie().map(value=>value.split(";",1)[0]).filter(Boolean).join("; ");
  if(!cookies) throw new Error(`login ${email}: no session cookies`);
  return cookies;
}
async function expectOk(path,cookie,label){
  const response=await fetch(`${previewUrl}${path}`,{headers:{Cookie:cookie},redirect:"manual"});
  if(!response.ok) throw new Error(`${label}: HTTP ${response.status} ${await response.text()}`);
  console.log(`PASS: ${label}`);
  return response;
}
const health=await fetch(`${previewUrl}/api/health`);
if(!health.ok) throw new Error(`health: HTTP ${health.status}`);
const healthBody=await health.json();
if(!healthBody.insforge?.configured) throw new Error("health: InsForge is not configured");
console.log("PASS: preview health and environment");
const adminCookie=await login(UAT_ADMIN_EMAIL);
await expectOk("/admin/catalog/samples-warranty",adminCookie,"admin sample/warranty workspace");
const adminData=await expectOk("/api/admin/catalog/samples-warranty",adminCookie,"admin sample/warranty API");
const adminBody=await adminData.json();
if(!adminBody.data?.samples?.length||!adminBody.data?.warranties?.length) throw new Error("admin UAT records are missing");
console.log("PASS: admin API contains UAT samples and warranty versions");
const memberCookie=await login(UAT_MEMBER_EMAIL);
await expectOk(`/member/catalog/${productResult.data.id}`,memberCookie,"member product detail page");
const memberData=await expectOk(`/api/member/catalog/${productResult.data.id}`,memberCookie,"member-safe product API");
const encoded=JSON.stringify(await memberData.json());
for(const forbidden of ["supplier_id","address_line","contact_name","contact_email","contact_phone","shelf_location","internal_note"]){
  if(encoded.includes(forbidden)) throw new Error(`member-safe API leaked ${forbidden}`);
}
console.log("PASS: hosted member API excludes internal sample fields");
console.log(`Slice 11 preview smoke complete: ${previewUrl}`);

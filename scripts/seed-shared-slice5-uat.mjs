import { createAdminClient, createClient } from "@insforge/sdk";
import { UAT_ADMIN_EMAIL, UAT_MEMBER_EMAIL } from "./uat-password.mjs";

const baseUrl = process.env.INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
const password = process.env.GISP_UAT_PASSWORD;

if (!baseUrl || !apiKey || !anonKey || !password) {
  throw new Error("Slice 5 UAT seed environment is incomplete");
}

const admin = createAdminClient({ baseUrl, apiKey });
const must = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};

async function signIn(email) {
  const client = createClient({ baseUrl, anonKey });
  must(await client.auth.signInWithPassword({ email, password }), `sign in ${email}`);
  const user = must(await client.auth.getCurrentUser(), `read ${email}`).user;
  if (!user?.id) throw new Error(`user id missing for ${email}`);
  return { client, user };
}

const operator = await signIn(UAT_ADMIN_EMAIL);
const member = await signIn(UAT_MEMBER_EMAIL);
const memberProfile = must(
  await admin.database.from("member_profiles").select("id,organization_id").eq("user_id", member.user.id).single(),
  "load shared UAT member profile",
);

let project = must(
  await admin.database.from("projects").select("id,project_number").eq("member_profile_id", memberProfile.id).eq("project_number", "PRJ-UAT-S5-001").maybeSingle(),
  "load shared UAT project",
);
if (!project) {
  project = must(
    await admin.database.from("projects").insert([{
      organization_id: memberProfile.organization_id,
      member_profile_id: memberProfile.id,
      project_number: "PRJ-UAT-S5-001",
      name: "โครงการทดสอบ Slice 5",
      site_address: "Bangkok UAT Site",
      expected_need_date: new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10),
      created_by: member.user.id,
    }]).select("id,project_number").single(),
    "create shared UAT project",
  );
}

let supplier = must(
  await admin.database.from("suppliers").select("id,code").eq("code", "UAT-S5-SUP").maybeSingle(),
  "load shared UAT supplier",
);
if (!supplier) {
  const supplierId = must(
    await operator.client.database.rpc("create_catalog_supplier", {
      code_input: "UAT-S5-SUP",
      name_input: "Slice 5 UAT Supplier",
      legal_name_input: "Slice 5 UAT Supplier Co., Ltd.",
      country_code_input: "TH",
      default_currency_input: "THB",
      contact_name_input: "UAT Contact",
      contact_email_input: "",
      contact_phone_input: "",
      website_url_input: "",
      default_lead_time_days_input: 30,
    }),
    "create shared UAT supplier",
  );
  must(
    await operator.client.database.rpc("activate_catalog_supplier", { supplier_id_input: supplierId }),
    "activate shared UAT supplier",
  );
  supplier = { id: supplierId, code: "UAT-S5-SUP" };
}

let request = must(
  await admin.database.from("custom_requests").select("id,request_number,status").eq("member_profile_id", memberProfile.id).eq("item_name", "ตู้บิลท์อินทดสอบ Slice 5").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  "load shared UAT custom request",
);

if (!request) {
  const requestId = must(
    await member.client.database.rpc("create_custom_request_draft", {
      project_id_input: project.id,
      area_id_input: null,
      base_product_id_input: null,
      request_type_input: "BUILT_IN",
      item_name_input: "ตู้บิลท์อินทดสอบ Slice 5",
      description_input: "ตู้บิลท์อินไม้วีเนียร์ พร้อมชั้นปรับระดับ สำหรับทดสอบ Custom Quotation",
      width_mm_input: 2400,
      depth_mm_input: 600,
      height_mm_input: 2600,
      quantity_input: 1,
      unit_input: "EA",
      requested_material_input: "Oak veneer",
      requested_color_input: "Natural oak",
      requested_function_input: "Adjustable shelving",
      member_note_input: "ข้อมูล UAT ถาวรสำหรับ Slice 5",
    }),
    "create shared UAT custom request",
  );
  must(await member.client.database.rpc("submit_custom_request_v2", { request_id_input: requestId }), "submit shared UAT request");
  must(
    await operator.client.database.rpc("admin_review_custom_request", {
      request_id_input: requestId,
      action_input: "START_REVIEW",
      message_input: "เริ่มตรวจข้อมูล UAT",
      assigned_to_input: operator.user.id,
      due_at_input: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    }),
    "start shared UAT review",
  );
  must(
    await operator.client.database.rpc("admin_set_custom_request_candidates", {
      request_id_input: requestId,
      supplier_ids_input: [supplier.id],
    }),
    "set shared UAT supplier candidate",
  );
  must(
    await operator.client.database.rpc("admin_review_custom_request", {
      request_id_input: requestId,
      action_input: "READY_FOR_QUOTE",
      message_input: "สเปก UAT พร้อมทำใบเสนอราคา",
      assigned_to_input: null,
      due_at_input: null,
    }),
    "ready shared UAT request",
  );
  request = must(
    await admin.database.from("custom_requests").select("id,request_number,status").eq("id", requestId).single(),
    "verify shared UAT request",
  );
}

let quotation = must(
  await admin.database.from("custom_quotations").select("id,quotation_number,version,status").eq("custom_request_id", request.id).eq("status", "SENT").order("version", { ascending: false }).limit(1).maybeSingle(),
  "load pending shared UAT quotation",
);

if (!quotation) {
  const quotationId = must(
    await operator.client.database.rpc("create_custom_quotation", {
      custom_request_id_input: request.id,
      subtotal_input: 85_000,
      lead_time_days_input: 30,
      valid_days_input: 30,
      supplier_id_input: supplier.id,
      supplier_cost_total_input: 50_000,
      quote_note_input: "ใบเสนอราคาตัวอย่างสำหรับ UAT Slice 5",
      confirmed_specification_input: "ตู้บิลท์อิน Oak veneer ขนาด 2400 × 600 × 2600 มม. พร้อมชั้นปรับระดับ",
    }),
    "create shared UAT quotation",
  );
  must(
    await operator.client.database.rpc("send_custom_quotation", { quotation_id_input: quotationId }),
    "send shared UAT quotation",
  );
  quotation = must(
    await admin.database.from("custom_quotations").select("id,quotation_number,version,status").eq("id", quotationId).single(),
    "verify shared UAT quotation",
  );
}

console.log(JSON.stringify({
  ok: true,
  projectNumber: project.project_number,
  requestNumber: request.request_number,
  quotationNumber: quotation.quotation_number,
  quotationVersion: quotation.version,
  quotationStatus: quotation.status,
}, null, 2));

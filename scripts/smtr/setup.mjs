import assert from "node:assert/strict";
import { COMPANIES, DEFAULT_RUN_ID, FIXTURE_VERSION } from "./fixtures.mjs";
import { loadDevelopmentTarget } from "./target-guard.mjs";
import { MANIFEST_PATH, SETUP_REPORT_PATH, writeJson } from "./io.mjs";

// This guard deliberately runs before the SDK module is loaded or any client exists.
const target = loadDevelopmentTarget();
const { createAdminClient, createClient } = await import("@insforge/sdk");
const { getUatPassword, UAT_ADMIN_EMAIL } = await import("../uat-password.mjs");

const runId = process.env.SMTR_RUN_ID || DEFAULT_RUN_ID;
const password = getUatPassword();
const admin = createAdminClient({ baseUrl: target.host, apiKey: process.env.INSFORGE_API_KEY });
const operator = createClient({ baseUrl: target.host, anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY });
const must = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};

must(await operator.auth.signInWithPassword({ email: UAT_ADMIN_EMAIL, password }), "sign in UAT operator");
assert.equal(must(await operator.database.rpc("has_permission", { permission_code: "members.approve", target_organization_id: null }), "check member approval permission"), true);

async function countTaggedOrganizations() {
  const rows = must(await admin.database.from("organizations").select("id").like("code", "SMTR10-%").limit(100), "count SMTR organizations");
  return rows.length;
}

async function ensureAuthUser(company) {
  const client = createClient({ baseUrl: target.host, anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY });
  let signedIn = await client.auth.signInWithPassword({ email: company.email, password });
  let created = false;
  if (signedIn.error) {
    const signUp = await admin.auth.signUp({ email: company.email, password, name: company.contactName, autoConfirm: true });
    if (signUp.error && !String(signUp.error.message).toLowerCase().includes("already")) {
      throw new Error(`create synthetic auth user ${company.key}: ${signUp.error.message}`);
    }
    created = !signUp.error;
    signedIn = await client.auth.signInWithPassword({ email: company.email, password });
  }
  must(signedIn, `sign in synthetic member ${company.key}`);
  const user = must(await client.auth.getCurrentUser(), `read synthetic member ${company.key}`).user;
  if (!user?.id) throw new Error(`missing auth user id for ${company.key}`);
  return { client, userId: user.id, created };
}

async function ensureCompany(company) {
  const auth = await ensureAuthUser(company);
  must(await auth.client.database.rpc("save_member_onboarding", {
    contact_name_input: company.contactName,
    contact_phone_input: null,
    company_name_input: company.companyName,
    company_legal_name_input: null,
    tax_id_input: null,
    business_type_input: company.businessType,
    address_line_input: "ที่อยู่จำลองสำหรับ Development เท่านั้น",
    district_input: "เขตจำลอง",
    province_input: "กรุงเทพมหานคร",
    postal_code_input: "00000",
    service_areas_input: ["พื้นที่จำลอง"],
    product_interests_input: ["สินค้าจำลอง"],
    training_interest_input: false,
    training_note_input: `${FIXTURE_VERSION}/${runId}`,
  }), `save onboarding ${company.key}`);

  const profile = must(await admin.database.from("member_profiles").select("id,user_id,organization_id").eq("user_id", auth.userId).single(), `load profile ${company.key}`);
  must(await admin.database.from("organizations").update({ code: company.organizationCode, name: company.companyName }).eq("id", profile.organization_id), `tag organization ${company.key}`);
  let application = must(await admin.database.from("member_applications").select("id,status").eq("user_id", auth.userId).single(), `load application ${company.key}`);
  if (["DRAFT", "REJECTED"].includes(application.status)) {
    must(await auth.client.database.rpc("submit_member_application", {}), `submit application ${company.key}`);
    application = must(await admin.database.from("member_applications").select("id,status").eq("id", application.id).single(), `reload application ${company.key}`);
  }
  if (["PENDING", "UNDER_REVIEW"].includes(application.status)) {
    must(await operator.database.rpc("approve_member_application", { application_id_input: application.id, review_note_input: `${FIXTURE_VERSION}/${runId} synthetic rehearsal` }), `approve application ${company.key}`);
  }
  const appUser = must(await admin.database.from("users").select("status").eq("id", auth.userId).single(), `load status ${company.key}`);
  if (appUser.status === "SUSPENDED") {
    must(await operator.database.rpc("reactivate_user", { target_user_id_input: auth.userId }), `reactivate ${company.key}`);
  } else if (appUser.status !== "ACTIVE") {
    throw new Error(`${company.key} has unsupported lifecycle status ${appUser.status}`);
  }

  let project = must(await auth.client.database.from("projects").select("id,organization_id,member_profile_id").eq("name", company.projectName).limit(1).maybeSingle(), `find project ${company.key}`);
  if (!project) {
    const projectId = must(await auth.client.database.rpc("create_project_v2", {
      name_input: company.projectName,
      project_type_input: "OTHER",
      end_customer_name_input: `[SMTR] ลูกค้าจำลอง ${company.key}`,
      end_customer_phone_input: null,
      end_customer_email_input: null,
      site_address_input: "สถานที่จำลอง Development",
      expected_need_date_input: null,
      note_input: `${FIXTURE_VERSION}/${runId}`,
    }), `create project ${company.key}`);
    project = must(await auth.client.database.from("projects").select("id,organization_id,member_profile_id").eq("id", projectId).single(), `read project ${company.key}`);
  }

  let projectItem = must(await admin.database.from("project_items").select("id,project_id,organization_id,status").eq("project_id", project.id).eq("item_type", "STANDARD").limit(1).maybeSingle(), `find project item ${company.key}`);
  if (!projectItem) {
    const visibleProducts = must(await auth.client.database.from("member_catalog").select("id,product_type").eq("product_type", "STANDARD").limit(100), `find member catalog product ${company.key}`);
    const productId = visibleProducts[0]?.id;
    if (!productId) throw new Error(`no published standard product is available for ${company.key}`);
    const variants = must(await admin.database.from("product_variants").select("id").eq("product_id", productId).eq("status", "ACTIVE").limit(1), `load variant ${company.key}`);
    const options = must(await admin.database.from("product_options").select("id,name,is_required").eq("product_id", productId).eq("status", "ACTIVE").order("sort_order"), `load options ${company.key}`);
    const selectedOptions = [];
    for (const option of options) {
      const values = must(await admin.database.from("product_option_values").select("id,label").eq("option_id", option.id).eq("status", "ACTIVE").order("sort_order").limit(1), `load option value ${company.key}`);
      if (values[0]) selectedOptions.push({ optionId: option.id, valueId: values[0].id, label: values[0].label });
      else if (option.is_required) throw new Error(`required option ${option.name} has no active value for ${company.key}`);
    }
    const projectItemId = must(await auth.client.database.rpc("add_standard_project_item_v2", {
      project_id_input: project.id,
      area_id_input: null,
      product_id_input: productId,
      variant_id_input: variants[0]?.id ?? null,
      selected_options_input: selectedOptions,
      quantity_input: 2,
    }), `create project item ${company.key}`);
    projectItem = must(await admin.database.from("project_items").select("id,project_id,organization_id,status").eq("id", projectItemId).single(), `read project item ${company.key}`);
  }
  if (projectItem.status !== "READY_TO_ORDER") {
    throw new Error(`${company.key} project item is not ready to order: ${projectItem.status}`);
  }

  let catalog = must(await auth.client.database.from("shared_catalogs").select("id,organization_id,member_profile_id,status").eq("title", company.catalogTitle).limit(1).maybeSingle(), `find shared catalog ${company.key}`);
  if (!catalog) {
    const catalogId = must(await auth.client.database.rpc("create_shared_catalog_draft", {
      title_input: company.catalogTitle,
      introduction_input: `${FIXTURE_VERSION}/${runId}`,
      brand_name_input: company.companyName,
      contact_name_input: company.contactName,
      contact_phone_input: null,
      contact_email_input: company.email,
      line_url_input: null,
      price_mode_input: "HIDDEN",
      expires_at_input: null,
    }), `create shared catalog ${company.key}`);
    catalog = must(await auth.client.database.from("shared_catalogs").select("id,organization_id,member_profile_id,status").eq("id", catalogId).single(), `read shared catalog ${company.key}`);
  }

  // The base sourcing table is intentionally not exposed to Member clients.
  // Admin reads here are fixture discovery only; RLS proof happens through the
  // member-safe can_access_sourcing_request RPC in verify.mjs.
  let sourcing = must(await admin.database.from("product_sourcing_requests").select("id,organization_id,member_profile_id,status").eq("member_profile_id", profile.id).eq("item_name", company.sourcingItemName).limit(1).maybeSingle(), `find sourcing request ${company.key}`);
  if (!sourcing) {
    const requestId = must(await auth.client.database.rpc("create_product_sourcing_draft", {
      project_id_input: project.id,
      area_id_input: null,
      item_name_input: company.sourcingItemName,
      description_input: `คำขอจำลองสำหรับ ${FIXTURE_VERSION} ใน Development เท่านั้น`,
      match_preference_input: "SIMILAR_OK",
      quantity_input: 1,
      unit_input: "EA",
      width_mm_input: null,
      depth_mm_input: null,
      height_mm_input: null,
      requested_material_input: "วัสดุจำลอง",
      requested_color_input: "สีจำลอง",
      budget_max_input: null,
      needed_at_input: null,
      source_url_input: null,
      member_note_input: `${FIXTURE_VERSION}/${runId}`,
    }), `create sourcing request ${company.key}`);
    sourcing = must(await admin.database.from("product_sourcing_requests").select("id,organization_id,member_profile_id,status").eq("id", requestId).single(), `read sourcing request ${company.key}`);
  }

  const objectKey = `smtr/v1/${company.key.toLowerCase()}/reference.png`;
  let file = must(await admin.database.from("file_metadata").select("id,organization_id,member_profile_id,bucket,object_key").eq("bucket", "gisp-member-private").eq("object_key", objectKey).maybeSingle(), `find private metadata ${company.key}`);
  if (!file) {
    file = must(await admin.database.from("file_metadata").insert([{
      organization_id: profile.organization_id,
      member_profile_id: profile.id,
      bucket: "gisp-member-private",
      object_key: objectKey,
      url: null,
      original_name: `${company.key.toLowerCase()}-synthetic-reference.png`,
      mime_type: "image/png",
      size_bytes: 68,
      visibility: "MEMBER_PRIVATE",
      entity_type: "PRODUCT_SOURCING_REQUEST",
      entity_id: sourcing.id,
      uploaded_by: auth.userId,
    }]).select("id,organization_id,member_profile_id,bucket,object_key").single(), `create private metadata ${company.key}`);
  }
  must(await admin.database.from("product_sourcing_files").upsert([{ request_id: sourcing.id, file_id: file.id, sort_order: 0 }], { onConflict: "request_id,file_id" }), `link sourcing file ${company.key}`);
  if (sourcing.status === "DRAFT") {
    must(await auth.client.database.rpc("submit_product_sourcing_request", { request_id_input: sourcing.id }), `submit sourcing request ${company.key}`);
    sourcing = must(await admin.database.from("product_sourcing_requests").select("id,organization_id,member_profile_id,status").eq("id", sourcing.id).single(), `reload sourcing request ${company.key}`);
  }

  const finalApplication = must(await admin.database.from("member_applications").select("id,status").eq("id", application.id).single(), `verify application ${company.key}`);
  const finalUser = must(await admin.database.from("users").select("status").eq("id", auth.userId).single(), `verify user ${company.key}`);
  const finalOrg = must(await admin.database.from("organizations").select("status,code").eq("id", profile.organization_id).single(), `verify organization ${company.key}`);
  return {
    key: company.key,
    scenario: company.scenario,
    email: company.email,
    userId: auth.userId,
    organizationId: profile.organization_id,
    organizationCode: finalOrg.code,
    memberProfileId: profile.id,
    applicationId: finalApplication.id,
    projectId: project.id,
    projectItemId: projectItem.id,
    sharedCatalogId: catalog.id,
    sourcingRequestId: sourcing.id,
    privateFileMetadataId: file.id,
    status: { user: finalUser.status, organization: finalOrg.status, application: finalApplication.status, sourcing: sourcing.status },
    authCreatedThisRun: auth.created,
  };
}

const beforeCount = await countTaggedOrganizations();
const manifest = {
  schemaVersion: 1,
  fixtureVersion: FIXTURE_VERSION,
  runId,
  environment: target,
  generatedAt: new Date().toISOString(),
  status: "in-progress",
  companies: [],
};
writeJson(MANIFEST_PATH, manifest);
for (const company of COMPANIES) {
  manifest.companies.push(await ensureCompany(company));
  writeJson(MANIFEST_PATH, manifest);
}
const afterCount = await countTaggedOrganizations();
assert.equal(manifest.companies.length, 5, "exactly five fixture definitions must exist");
assert.equal(new Set(manifest.companies.map((item) => item.organizationId)).size, 5, "organization ids must be distinct");
assert.equal(new Set(manifest.companies.map((item) => item.userId)).size, 5, "user ids must be distinct");
assert.equal(new Set(manifest.companies.map((item) => item.memberProfileId)).size, 5, "member profile ids must be distinct");
assert.equal(afterCount, 5, "Development must contain exactly five SMTR-v1.0 organizations");
manifest.status = "ready";
manifest.completedAt = new Date().toISOString();
writeJson(MANIFEST_PATH, manifest);
writeJson(SETUP_REPORT_PATH, {
  fixtureVersion: FIXTURE_VERSION,
  runId,
  environment: target,
  completedAt: manifest.completedAt,
  beforeTaggedOrganizationCount: beforeCount,
  afterTaggedOrganizationCount: afterCount,
  companyCount: manifest.companies.length,
  authUsersCreatedThisRun: manifest.companies.filter((item) => item.authCreatedThisRun).length,
  secretMaterialRecorded: false,
  result: "PASS",
});
console.log(JSON.stringify({ result: "PASS", fixtureVersion: FIXTURE_VERSION, runId, beforeCount, afterCount, companyCount: 5, manifest: "output/smtr/SMTR-v1.0-manifest.json" }, null, 2));

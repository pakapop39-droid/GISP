import { createAdminClient, createClient } from "@insforge/sdk";
import { getUatPassword } from "./uat-password.mjs";

const baseUrl = process.env.INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
if (!baseUrl || !apiKey || !anonKey) throw new Error("Slice 13 branch test environment is incomplete");
if (!baseUrl.includes("kit6y4pj-fnf")) throw new Error("Refusing to test outside slice-13-visual-sourcing");

const admin = createAdminClient({ baseUrl, apiKey });
const password = getUatPassword();
const runId = Date.now();
const results = [];
const must = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};
const assert = (condition, label) => {
  if (!condition) throw new Error(`FAILED: ${label}`);
  results.push(`PASS: ${label}`);
};
const expectError = async (operation, label) => {
  try {
    const result = await operation();
    assert(Boolean(result.error), label);
    return result.error;
  } catch (error) {
    assert(Boolean(error), label);
    return error;
  }
};

async function createUser(prefix) {
  const email = `${prefix}.${runId}@example.com`;
  const created = must(
    await admin.auth.signUp({ email, password, name: prefix, autoConfirm: true }),
    `create ${prefix}`,
  );
  let id = created?.user?.id;
  if (!id && created?.accessToken) {
    const temporary = createClient({ baseUrl, accessToken: created.accessToken, isServerMode: true });
    id = must(await temporary.auth.getCurrentUser(), `read ${prefix}`).user?.id;
  }
  if (!id) {
    id = must(
      await admin.database.rpc("operator_find_auth_user_id", { email_input: email }),
      `lookup ${prefix}`,
    );
  }
  return { id, email };
}

async function signIn(user) {
  const client = createClient({ baseUrl, anonKey });
  must(await client.auth.signInWithPassword({ email: user.email, password }), `sign in ${user.email}`);
  return client;
}

async function addReferenceImage(requestId, profile, userId, index, overrides = {}) {
  const metadata = must(
    await admin.database
      .from("file_metadata")
      .insert([
        {
          organization_id: profile.organization_id,
          member_profile_id: profile.id,
          bucket: "gisp-member-private",
          object_key: `slice13-test/${requestId}/reference-${index}.png`,
          url: null,
          original_name: `reference-${index}.png`,
          mime_type: "image/png",
          size_bytes: 68,
          visibility: "MEMBER_PRIVATE",
          entity_type: "PRODUCT_SOURCING_REQUEST",
          entity_id: requestId,
          uploaded_by: userId,
          ...overrides,
        },
      ])
      .select("id")
      .single(),
    `create reference metadata ${index}`,
  );
  return admin.database
    .from("product_sourcing_files")
    .insert([{ request_id: requestId, file_id: metadata.id, sort_order: index }]);
}

async function createDraft(client, suffix) {
  return must(
    await client.database.rpc("create_product_sourcing_draft", {
      project_id_input: null,
      area_id_input: null,
      item_name_input: `เก้าอี้จากภาพ ${suffix}`,
      description_input: `ต้องการหาสินค้าสำเร็จรูปตามภาพอ้างอิงสำหรับการทดสอบ ${suffix}`,
      match_preference_input: "SIMILAR_OK",
      quantity_input: 2,
      unit_input: "EA",
      width_mm_input: 700,
      depth_mm_input: 800,
      height_mm_input: 850,
      requested_material_input: "หนัง",
      requested_color_input: "ดำ",
      budget_max_input: 30000,
      needed_at_input: null,
      source_url_input: "https://example.com/reference",
      member_note_input: "ข้อมูลที่ Member มองเห็นได้",
    }),
    `create sourcing draft ${suffix}`,
  );
}

async function prepareSubmitted(client, profile, userId, suffix) {
  const id = await createDraft(client, suffix);
  must(await addReferenceImage(id, profile, userId, 0), `attach reference ${suffix}`);
  must(
    await client.database.rpc("submit_product_sourcing_request", { request_id_input: id }),
    `submit ${suffix}`,
  );
  return id;
}

const operator = await createUser("slice13-admin");
const memberA = await createUser("slice13-member-a");
const memberB = await createUser("slice13-member-b");

must(
  await admin.database.from("countries").upsert(
    [
      { code: "TH", name_th: "ประเทศไทย", name_en: "Thailand", status: "ACTIVE" },
      { code: "CN", name_th: "ประเทศจีน", name_en: "China", status: "ACTIVE" },
    ],
    { onConflict: "code" },
  ),
  "seed countries",
);
const internalOrganization = must(
  await admin.database
    .from("organizations")
    .insert([
      {
        code: `GISP-${runId}`,
        name: "Global Interior Supply Platform",
        status: "ACTIVE",
        approved_at: new Date().toISOString(),
      },
    ])
    .select("id")
    .single(),
  "create internal organization",
);
const organizationA = must(
  await admin.database
    .from("organizations")
    .insert([{ code: `S13-A-${runId}`, name: "Slice 13 Company A", status: "ACTIVE", approved_at: new Date().toISOString() }])
    .select("id")
    .single(),
  "create organization A",
);
const organizationB = must(
  await admin.database
    .from("organizations")
    .insert([{ code: `S13-B-${runId}`, name: "Slice 13 Company B", status: "ACTIVE", approved_at: new Date().toISOString() }])
    .select("id")
    .single(),
  "create organization B",
);

must(
  await admin.database.from("users").insert([
    { id: operator.id, primary_organization_id: internalOrganization.id, full_name: "Slice 13 Admin", status: "ACTIVE" },
    { id: memberA.id, primary_organization_id: organizationA.id, full_name: "Slice 13 Member A", status: "ACTIVE" },
    { id: memberB.id, primary_organization_id: organizationB.id, full_name: "Slice 13 Member B", status: "ACTIVE" },
  ]),
  "create user profiles",
);
const superRole = must(
  await admin.database
    .from("roles")
    .upsert([{ code: "SUPER_ADMIN", name: "Super Admin", description: "Slice 13 test operator" }], { onConflict: "code" })
    .select("id")
    .single(),
  "create super admin role",
);
const memberRole = must(
  await admin.database
    .from("roles")
    .upsert([{ code: "MEMBER", name: "Member", description: "Approved member" }], { onConflict: "code" })
    .select("id")
    .single(),
  "create member role",
);
const sourcingPermission = must(
  await admin.database.from("permissions").select("id").eq("code", "sourcing.manage").single(),
  "load sourcing permission",
);
must(
  await admin.database.from("role_permissions").upsert([
    { role_id: superRole.id, permission_id: sourcingPermission.id },
  ], { onConflict: "role_id,permission_id" }),
  "grant sourcing permission",
);
must(
  await admin.database.from("user_roles").insert([
    { user_id: operator.id, role_id: superRole.id, organization_id: null, assigned_by: operator.id },
    { user_id: memberA.id, role_id: memberRole.id, organization_id: organizationA.id, assigned_by: operator.id },
    { user_id: memberB.id, role_id: memberRole.id, organization_id: organizationB.id, assigned_by: operator.id },
  ]),
  "assign roles",
);
const profileA = must(
  await admin.database
    .from("member_profiles")
    .insert([{ user_id: memberA.id, organization_id: organizationA.id, contact_name: "Member A", company_name: "Slice 13 Company A" }])
    .select("id,organization_id")
    .single(),
  "create member profile A",
);
const profileB = must(
  await admin.database
    .from("member_profiles")
    .insert([{ user_id: memberB.id, organization_id: organizationB.id, contact_name: "Member B", company_name: "Slice 13 Company B" }])
    .select("id,organization_id")
    .single(),
  "create member profile B",
);
must(
  await admin.database.from("member_applications").insert([
    { user_id: memberA.id, organization_id: organizationA.id, member_profile_id: profileA.id, status: "APPROVED", reviewed_at: new Date().toISOString(), reviewed_by: operator.id },
    { user_id: memberB.id, organization_id: organizationB.id, member_profile_id: profileB.id, status: "APPROVED", reviewed_at: new Date().toISOString(), reviewed_by: operator.id },
  ]),
  "approve member fixtures",
);

const operatorClient = await signIn(operator);
const memberAClient = await signIn(memberA);
const memberBClient = await signIn(memberB);
assert(
  must(await operatorClient.database.rpc("has_permission", { permission_code: "sourcing.manage" }), "check sourcing permission") === true,
  "authorized operations staff has sourcing.manage",
);

const mainRequest = await createDraft(memberAClient, "MAIN");
await expectError(
  () => memberAClient.database.rpc("submit_product_sourcing_request", { request_id_input: mainRequest }),
  "request cannot be submitted without a reference image",
);
await expectError(
  () => addReferenceImage(mainRequest, profileA, memberA.id, 90, { mime_type: "text/plain" }),
  "database rejects an invalid reference MIME type",
);
await expectError(
  () => addReferenceImage(mainRequest, profileA, memberA.id, 91, { organization_id: organizationB.id }),
  "database rejects cross-company reference metadata",
);
for (let index = 0; index < 8; index += 1) {
  must(await addReferenceImage(mainRequest, profileA, memberA.id, index), `attach valid reference ${index + 1}`);
}
await expectError(
  () => addReferenceImage(mainRequest, profileA, memberA.id, 9),
  "database enforces the maximum of eight reference images",
);
await expectError(
  () => memberAClient.database.from("product_sourcing_requests").update({ status: "COMPLETED" }).eq("id", mainRequest),
  "member cannot update workflow status directly",
);
await expectError(
  () => memberAClient.database.from("product_sourcing_files").insert([{ request_id: mainRequest, file_id: crypto.randomUUID() }]),
  "member cannot write sourcing file links directly",
);
must(
  await memberAClient.database.rpc("submit_product_sourcing_request", { request_id_input: mainRequest }),
  "submit main request",
);
assert(
  must(await memberBClient.database.rpc("can_access_sourcing_request", { request_id_input: mainRequest }), "check cross-company access") === false,
  "another member company cannot access the request",
);
await expectError(
  () => memberBClient.database.rpc("cancel_product_sourcing_request", { request_id_input: mainRequest, reason_input: "ไม่มีสิทธิ์" }),
  "another member company cannot change the request",
);
await expectError(
  () => memberBClient.database.from("product_sourcing_requests").select("id").eq("id", mainRequest),
  "base request table is not exposed to authenticated clients",
);
await expectError(
  () => memberAClient.database.rpc("next_record_reference", { target_prefix: "PSR" }),
  "member cannot call the document sequence helper directly",
);
await expectError(
  () => memberAClient.database.rpc("admin_product_sourcing_action", { request_id_input: mainRequest, action_input: "START_REVIEW", message_input: null }),
  "member cannot run the sourcing admin workflow",
);

must(
  await operatorClient.database.rpc("admin_product_sourcing_action", { request_id_input: mainRequest, action_input: "START_REVIEW", message_input: null }),
  "start review",
);
must(
  await operatorClient.database.rpc("admin_product_sourcing_action", { request_id_input: mainRequest, action_input: "REQUEST_INFO", message_input: "กรุณาระบุสีที่ต้องการ" }),
  "request more information",
);
must(
  await memberAClient.database.rpc("save_product_sourcing_request", {
    request_id_input: mainRequest,
    project_id_input: null,
    area_id_input: null,
    item_name_input: "เก้าอี้จากภาพ MAIN",
    description_input: "ปรับข้อมูลตามที่ทีมจัดหาขอเพิ่มเติมและยืนยันสีดำ",
    match_preference_input: "SIMILAR_OK",
    quantity_input: 2,
    unit_input: "EA",
    width_mm_input: 700,
    depth_mm_input: 800,
    height_mm_input: 850,
    requested_material_input: "หนัง",
    requested_color_input: "ดำ",
    budget_max_input: 30000,
    needed_at_input: null,
    source_url_input: null,
    member_note_input: "ยืนยันสีดำ",
  }),
  "member supplies more information",
);
must(
  await memberAClient.database.rpc("submit_product_sourcing_request", { request_id_input: mainRequest }),
  "member resubmits after information request",
);
must(
  await operatorClient.database.rpc("admin_product_sourcing_action", { request_id_input: mainRequest, action_input: "START_REVIEW", message_input: null }),
  "restart review",
);

const supplier = must(
  await admin.database.from("suppliers").insert([{ code: `S13-SUP-${runId}`, name: "Secret Slice 13 Supplier", country_code: "CN", internal_note: "SECRET NEGOTIATION", status: "ACTIVE" }]).select("id").single(),
  "create supplier",
);
const category = must(
  await admin.database.from("categories").insert([{ code: `S13-CAT-${runId}`, name_th: "เก้าอี้ทดสอบ", status: "ACTIVE" }]).select("id").single(),
  "create category",
);
const candidateInput = {
  request_id_input: mainRequest,
  candidate_id_input: null,
  supplier_id_input: supplier.id,
  category_id_input: category.id,
  proposed_sku_input: `S13-P-${runId}`,
  factory_sku_input: "SECRET-FACTORY-SKU",
  product_type_input: "STANDARD",
  country_code_input: "CN",
  name_th_input: "เก้าอี้หนังรุ่นใกล้เคียง",
  name_en_input: "Similar leather chair",
  description_input: "ตัวเลือกที่ทีมจัดหาคัดเลือก",
  specification_input: "ขนาดใกล้เคียงภาพอ้างอิง",
  material_input: "หนัง",
  finish_input: "สีดำ",
  member_price_input: 25000,
  lead_time_input: 45,
  factory_cost_input: 9999,
  factory_currency_input: "CNY",
  internal_note_input: "SECRET INTERNAL NOTE",
};
await expectError(
  () => memberAClient.database.rpc("save_sourcing_candidate", candidateInput),
  "member cannot create an internal sourcing candidate",
);
const candidateId = must(
  await operatorClient.database.rpc("save_sourcing_candidate", candidateInput),
  "create sourcing candidate",
);
await expectError(
  () => memberAClient.database.rpc("delete_sourcing_candidate", { request_id_input: mainRequest, candidate_id_input: candidateId }),
  "member cannot delete an internal sourcing candidate",
);
const candidateFile = must(
  await admin.database.from("file_metadata").insert([{
    organization_id: organizationA.id,
    member_profile_id: profileA.id,
    bucket: "gisp-member-private",
    object_key: `slice13-test/${mainRequest}/candidate.png`,
    url: null,
    original_name: "candidate.png",
    mime_type: "image/png",
    size_bytes: 68,
    visibility: "MEMBER_PRIVATE",
    entity_type: "PRODUCT_SOURCING_CANDIDATE",
    entity_id: candidateId,
    uploaded_by: operator.id,
  }]).select("id").single(),
  "create candidate image metadata",
);
must(
  await admin.database.from("product_sourcing_candidate_files").insert([{ candidate_id: candidateId, file_id: candidateFile.id, sort_order: 0 }]),
  "attach candidate image",
);
const wrongCandidateFile = must(
  await admin.database.from("file_metadata").insert([{
    organization_id: organizationB.id,
    member_profile_id: profileB.id,
    bucket: "gisp-member-private",
    object_key: `slice13-test/${mainRequest}/wrong-candidate.png`,
    url: null,
    original_name: "wrong-candidate.png",
    mime_type: "image/png",
    size_bytes: 68,
    visibility: "MEMBER_PRIVATE",
    entity_type: "PRODUCT_SOURCING_CANDIDATE",
    entity_id: candidateId,
    uploaded_by: operator.id,
  }]).select("id").single(),
  "create invalid candidate metadata fixture",
);
await expectError(
  () => admin.database.from("product_sourcing_candidate_files").insert([{ candidate_id: candidateId, file_id: wrongCandidateFile.id, sort_order: 1 }]),
  "database rejects a candidate image from another company",
);
must(
  await operatorClient.database.rpc("admin_product_sourcing_action", { request_id_input: mainRequest, action_input: "PUBLISH_OPTIONS", message_input: "มีตัวเลือกให้พิจารณา" }),
  "publish sourcing options",
);
await expectError(
  () => memberBClient.database.rpc("select_sourcing_candidate", { request_id_input: mainRequest, candidate_id_input: candidateId }),
  "another member company cannot select a candidate",
);
must(
  await memberAClient.database.rpc("select_sourcing_candidate", { request_id_input: mainRequest, candidate_id_input: candidateId }),
  "request owner selects a candidate",
);
await expectError(
  () => memberAClient.database.rpc("create_sourcing_product_draft", { request_id_input: mainRequest, candidate_id_input: candidateId }),
  "member cannot create a product draft from the selected candidate",
);

const publishedProduct = must(
  await admin.database.from("products").insert([{
    supplier_id: supplier.id,
    category_id: category.id,
    sku: `S13-LINK-${runId}`,
    product_type: "STANDARD",
    name_th: "สินค้าจัดหาที่ผ่านการตรวจแล้ว",
    country_code: "CN",
    factory_cost: 9999,
    factory_currency: "CNY",
    internal_note: "SECRET PRODUCT NOTE",
    status: "PUBLISHED",
    qa_status: "PASSED",
    published_at: new Date().toISOString(),
    reviewed_by: operator.id,
    reviewed_at: new Date().toISOString(),
    created_by: operator.id,
  }]).select("id").single(),
  "create published product",
);
await expectError(
  () => memberAClient.database.rpc("link_sourcing_product", { request_id_input: mainRequest, candidate_id_input: candidateId, product_id_input: publishedProduct.id }),
  "member cannot link an internal product to the sourcing request",
);
must(
  await operatorClient.database.rpc("link_sourcing_product", { request_id_input: mainRequest, candidate_id_input: candidateId, product_id_input: publishedProduct.id }),
  "link approved product and complete request",
);
const mainStatus = must(
  await admin.database.from("product_sourcing_requests").select("status").eq("id", mainRequest).single(),
  "read completed request",
);
assert(mainStatus.status === "COMPLETED", "selected candidate becomes a completed request after product publication");

const history = must(
  await admin.database.from("product_sourcing_history").select("id,action,to_status").eq("request_id", mainRequest).order("created_at"),
  "load request history",
);
assert(
  ["DRAFT_CREATED", "SUBMITTED", "START_REVIEW", "REQUEST_INFO", "RESUBMITTED", "CANDIDATE_SELECTED", "PUBLISHED_PRODUCT_LINKED"].every((action) => history.some((row) => row.action === action)),
  "history records the complete workflow",
);
await expectError(
  () => admin.database.from("product_sourcing_history").update({ action: "TAMPERED" }).eq("id", history[0].id),
  "history is append-only even for the service role",
);

const rejectRequest = await prepareSubmitted(memberAClient, profileA, memberA.id, "REJECT");
must(await operatorClient.database.rpc("admin_product_sourcing_action", { request_id_input: rejectRequest, action_input: "START_REVIEW", message_input: null }), "review reject flow");
const rejectCandidate = must(await operatorClient.database.rpc("save_sourcing_candidate", { ...candidateInput, request_id_input: rejectRequest, proposed_sku_input: `S13-R-${runId}` }), "create reject-flow candidate");
must(await operatorClient.database.rpc("admin_product_sourcing_action", { request_id_input: rejectRequest, action_input: "PUBLISH_OPTIONS", message_input: null }), "publish reject-flow option");
must(await memberAClient.database.rpc("reject_sourcing_options", { request_id_input: rejectRequest, message_input: "ขอสีที่เข้มกว่านี้" }), "reject all options");
assert(
  must(await admin.database.from("product_sourcing_requests").select("status").eq("id", rejectRequest).single(), "read reject status").status === "UNDER_REVIEW",
  "rejecting all options returns the request to review",
);
assert(Boolean(rejectCandidate), "reject flow candidate was created");

const unavailableRequest = await prepareSubmitted(memberAClient, profileA, memberA.id, "UNAVAILABLE");
must(await operatorClient.database.rpc("admin_product_sourcing_action", { request_id_input: unavailableRequest, action_input: "START_REVIEW", message_input: null }), "review unavailable flow");
must(await operatorClient.database.rpc("admin_product_sourcing_action", { request_id_input: unavailableRequest, action_input: "MARK_UNAVAILABLE", message_input: "ไม่พบสินค้าที่เหมาะสม" }), "mark unavailable");
assert(
  must(await admin.database.from("product_sourcing_requests").select("status").eq("id", unavailableRequest).single(), "read unavailable status").status === "UNAVAILABLE",
  "operations can close a request as unavailable",
);

const cancelledRequest = await createDraft(memberAClient, "CANCEL");
must(await memberAClient.database.rpc("cancel_product_sourcing_request", { request_id_input: cancelledRequest, reason_input: "ไม่ต้องการสินค้าแล้ว" }), "cancel draft request");
assert(
  must(await admin.database.from("product_sourcing_requests").select("status").eq("id", cancelledRequest).single(), "read cancelled status").status === "CANCELLED",
  "member can cancel their own request",
);

console.log(results.join("\n"));
console.log(`Slice 13 branch integration passed: ${results.length} assertions`);

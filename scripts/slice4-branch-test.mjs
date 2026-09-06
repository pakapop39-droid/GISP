import { createAdminClient, createClient } from "@insforge/sdk";
import { getUatPassword } from "./uat-password.mjs";

const baseUrl = process.env.INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
if (!baseUrl || !apiKey || !anonKey) throw new Error("Slice 4 branch test environment is incomplete");

const admin = createAdminClient({ baseUrl, apiKey });
const password = getUatPassword();
const runId = Date.now();
const results = [];
const assert = (condition, label) => {
  if (!condition) throw new Error(`FAILED: ${label}`);
  results.push(`PASS: ${label}`);
};
const must = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
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

async function onboard(client, suffix) {
  must(await client.database.rpc("save_member_onboarding", {
    contact_name_input: `Slice 4 Member ${suffix}`,
    contact_phone_input: "0800000000",
    company_name_input: `Slice 4 Member ${suffix} ${runId}`,
    company_legal_name_input: `Slice 4 Member ${suffix} ${runId} Co., Ltd.`,
    tax_id_input: `${suffix === "A" ? "04" : "05"}${String(runId).slice(-11)}`,
    business_type_input: "Interior Design",
    address_line_input: "Bangkok",
    district_input: "Pathum Wan",
    province_input: "Bangkok",
    postal_code_input: "10330",
    service_areas_input: ["Bangkok"],
    product_interests_input: ["Custom Furniture"],
    training_interest_input: false,
    training_note_input: null,
  }), `save onboarding ${suffix}`);
  return must(await client.database.rpc("submit_member_application", {}), `submit application ${suffix}`);
}

const operator = await createUser("slice4-admin");
let internalOrganization = must(
  await admin.database.from("organizations").select("id").eq("code", "GISP").maybeSingle(),
  "load GISP organization",
);
if (!internalOrganization) {
  internalOrganization = must(await admin.database.from("organizations").insert([{
    code: "GISP", name: "Global Interior Supply Platform", status: "ACTIVE",
    approved_at: new Date().toISOString(),
  }]).select("id"), "create GISP organization")[0];
}
must(await admin.database.from("users").insert([{
  id: operator.id,
  primary_organization_id: internalOrganization.id,
  full_name: "Slice 4 RFQ Admin",
  status: "ACTIVE",
}]), "create RFQ admin profile");
const superRole = must(
  await admin.database.from("roles").select("id").eq("code", "SUPER_ADMIN").single(),
  "load Super Admin role",
);
must(await admin.database.from("user_roles").insert([{
  user_id: operator.id, role_id: superRole.id, organization_id: null, assigned_by: operator.id,
}]), "assign RFQ admin role");
const operatorClient = await signIn(operator);

const memberA = await createUser("slice4-member-a");
const memberB = await createUser("slice4-member-b");
const memberAClient = await signIn(memberA);
const memberBClient = await signIn(memberB);
const applicationA = await onboard(memberAClient, "A");
const applicationB = await onboard(memberBClient, "B");
must(await operatorClient.database.rpc("approve_member_application", {
  application_id_input: applicationA, review_note_input: "Slice 4 integration approval",
}), "approve member A");
must(await operatorClient.database.rpc("approve_member_application", {
  application_id_input: applicationB, review_note_input: "Slice 4 integration approval",
}), "approve member B");

const profiles = must(
  await admin.database.from("member_profiles").select("id,user_id,organization_id"),
  "load member profiles",
);
const profileA = profiles.find((row) => row.user_id === memberA.id);
const profileB = profiles.find((row) => row.user_id === memberB.id);
if (!profileA || !profileB) throw new Error("Approved member profiles are missing");

const projects = must(await admin.database.from("projects").insert([
  {
    organization_id: profileA.organization_id,
    member_profile_id: profileA.id,
    project_number: `PRJ-S4A-${runId}`,
    name: "Slice 4 Member A Project",
    site_address: "Bangkok A",
    expected_need_date: new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10),
    created_by: memberA.id,
  },
  {
    organization_id: profileB.organization_id,
    member_profile_id: profileB.id,
    project_number: `PRJ-S4B-${runId}`,
    name: "Slice 4 Member B Project",
    site_address: "Bangkok B",
    created_by: memberB.id,
  },
]).select("id,member_profile_id"), "create isolated projects");
const projectA = projects.find((row) => row.member_profile_id === profileA.id);
if (!projectA) throw new Error("Member A project is missing");

const supplierId = must(await operatorClient.database.rpc("create_catalog_supplier", {
  code_input: `S4-${runId}`,
  name_input: "Slice 4 Candidate Supplier",
  legal_name_input: "Slice 4 Candidate Supplier Co., Ltd.",
  country_code_input: "TH",
  default_currency_input: "THB",
  contact_name_input: "RFQ Contact",
  contact_email_input: "",
  contact_phone_input: "",
  website_url_input: "",
  default_lead_time_days_input: 30,
}), "create candidate supplier");
must(await operatorClient.database.rpc("activate_catalog_supplier", {
  supplier_id_input: supplierId,
}), "activate candidate supplier");

const requestInput = {
  project_id_input: projectA.id,
  area_id_input: null,
  base_product_id_input: null,
  request_type_input: "PROJECT_SPECIFIC",
  item_name_input: "Built-in feature wall",
  description_input: "Custom feature wall sized for the member project lobby.",
  width_mm_input: 4200,
  depth_mm_input: 450,
  height_mm_input: 2800,
  quantity_input: 1,
  unit_input: "SET",
  requested_material_input: "Oak veneer",
  requested_color_input: "Natural oak",
  requested_function_input: "Concealed storage",
  member_note_input: "Coordinate with site ceiling level",
};

const requestId = must(
  await memberAClient.database.rpc("create_custom_request_draft", requestInput),
  "create custom request draft",
);
const draft = must(
  await memberAClient.database.from("custom_requests").select("id,request_number,status,request_type,requested_options_json").eq("id", requestId).single(),
  "read member A draft",
);
assert(
  draft.request_number.startsWith("CRQ-") && draft.status === "DRAFT" && draft.request_type === "PROJECT_SPECIFIC",
  "draft uses atomic CRQ reference and canonical request type",
);
assert(draft.requested_options_json.material === "Oak veneer", "requested options are stored as structured data");

const crossMemberRead = must(
  await memberBClient.database.from("custom_requests").select("id").eq("id", requestId),
  "member B direct request read",
);
assert(crossMemberRead.length === 0, "RLS hides member A request from member B");
const crossMemberDetail = await memberBClient.database.rpc("get_member_custom_request_detail", { request_id_input: requestId });
assert(Boolean(crossMemberDetail.error), "detail RPC rejects cross-member access");

const directWrite = await memberAClient.database.from("custom_requests").update({ status: "CONVERTED" }).eq("id", requestId);
assert(Boolean(directWrite.error), "direct member status mutation is denied");

const earlyCandidate = await operatorClient.database.rpc("admin_set_custom_request_candidates", {
  request_id_input: requestId, supplier_ids_input: [supplierId],
});
assert(Boolean(earlyCandidate.error), "supplier candidates cannot be set before review starts");

must(await memberAClient.database.rpc("submit_custom_request_v2", { request_id_input: requestId }), "submit draft");
const invalidAssignee = await operatorClient.database.rpc("admin_review_custom_request", {
  request_id_input: requestId,
  action_input: "START_REVIEW",
  message_input: "",
  assigned_to_input: memberB.id,
  due_at_input: new Date(Date.now() + 2 * 86400000).toISOString(),
});
assert(Boolean(invalidAssignee.error), "review assignment rejects users without rfq.manage");

must(await operatorClient.database.rpc("admin_review_custom_request", {
  request_id_input: requestId,
  action_input: "START_REVIEW",
  message_input: "",
  assigned_to_input: operator.id,
  due_at_input: new Date(Date.now() + 2 * 86400000).toISOString(),
}), "start review with assignee and due date");
let requestRow = must(
  await admin.database.from("custom_requests").select("status").eq("id", requestId).single(),
  "read review state",
);
const reviewAssignment = must(
  await admin.database.from("assignments").select("assigned_to,due_at,status").eq("entity_type", "CUSTOM_REQUEST").eq("entity_id", requestId).eq("status", "IN_PROGRESS").single(),
  "read review assignment",
);
assert(requestRow.status === "UNDER_REVIEW" && reviewAssignment.assigned_to === operator.id && Boolean(reviewAssignment.due_at), "SUBMITTED transitions to UNDER_REVIEW with assignment and due date");

must(await operatorClient.database.rpc("admin_review_custom_request", {
  request_id_input: requestId,
  action_input: "REQUEST_INFO",
  message_input: "Please confirm the power outlet position.",
  assigned_to_input: null,
  due_at_input: null,
}), "request more information");
requestRow = must(await admin.database.from("custom_requests").select("status").eq("id", requestId).single(), "read need-info state");
assert(requestRow.status === "NEED_INFO", "UNDER_REVIEW transitions to NEED_INFO");

must(await memberAClient.database.rpc("save_custom_request_details", {
  request_id_input: requestId,
  ...requestInput,
  member_note_input: "Power outlet confirmed at 300 mm above finished floor.",
}), "member saves requested information");
must(await memberAClient.database.rpc("submit_custom_request_v2", { request_id_input: requestId }), "member resubmits request");
requestRow = must(await admin.database.from("custom_requests").select("status").eq("id", requestId).single(), "read resubmitted state");
assert(requestRow.status === "SUBMITTED", "NEED_INFO transitions back to SUBMITTED");

must(await operatorClient.database.rpc("admin_review_custom_request", {
  request_id_input: requestId,
  action_input: "START_REVIEW",
  message_input: "",
  assigned_to_input: operator.id,
  due_at_input: new Date(Date.now() + 2 * 86400000).toISOString(),
}), "restart review");
must(await operatorClient.database.rpc("admin_set_custom_request_candidates", {
  request_id_input: requestId, supplier_ids_input: [supplierId],
}), "set supplier candidate");
must(await operatorClient.database.rpc("admin_review_custom_request", {
  request_id_input: requestId,
  action_input: "SAVE_NOTE",
  message_input: "Supplier can manufacture the curved panel.",
  assigned_to_input: null,
  due_at_input: null,
}), "save internal admin note");
must(await operatorClient.database.rpc("admin_review_custom_request", {
  request_id_input: requestId,
  action_input: "READY_FOR_QUOTE",
  message_input: "Specification and supplier candidate confirmed.",
  assigned_to_input: null,
  due_at_input: null,
}), "mark request ready for quote");
const ready = must(
  await admin.database.from("custom_requests").select("status,admin_note").eq("id", requestId).single(),
  "read ready-for-quote state",
);
const completedReview = must(
  await admin.database.from("assignments").select("status").eq("entity_type", "CUSTOM_REQUEST").eq("entity_id", requestId).order("created_at", { ascending: false }).limit(1).single(),
  "read completed review assignment",
);
assert(ready.status === "READY_FOR_QUOTE" && completedReview.status === "DONE", "UNDER_REVIEW transitions to READY_FOR_QUOTE and completes the assignment");
assert(ready.admin_note === "Supplier can manufacture the curved panel.", "internal admin note is stored on the request");

const memberDetail = must(
  await memberAClient.database.rpc("get_member_custom_request_detail", { request_id_input: requestId }),
  "read member detail projection",
);
assert(!Object.hasOwn(memberDetail.request, "admin_note"), "member projection excludes internal admin note");
assert(memberDetail.history.every((entry) => entry.visibility === "MEMBER"), "member history excludes internal events");

const historyRow = must(
  await admin.database.from("custom_request_history").select("id").eq("custom_request_id", requestId).limit(1).single(),
  "load history row",
);
const historyMutation = await admin.database.from("custom_request_history").update({ action: "TAMPERED" }).eq("id", historyRow.id);
assert(Boolean(historyMutation.error), "request history is append-only");

const fileMetadata = must(await admin.database.from("file_metadata").insert([{
  organization_id: profileA.organization_id,
  member_profile_id: profileA.id,
  bucket: "gisp-member-private",
  object_key: `custom-requests/${profileA.id}/${requestId}/slice4-${runId}.pdf`,
  url: null,
  original_name: "slice4-spec.pdf",
  mime_type: "application/pdf",
  size_bytes: 128,
  visibility: "MEMBER_PRIVATE",
  entity_type: "CUSTOM_REQUEST",
  entity_id: requestId,
  uploaded_by: memberA.id,
}]).select("id"), "create file metadata")[0];
must(await admin.database.from("custom_request_files").insert([{
  custom_request_id: requestId,
  file_id: fileMetadata.id,
  file_role: "PDF",
  version_number: 1,
  uploaded_by: memberA.id,
}]), "link versioned request file");
const memberAFile = must(await memberAClient.database.from("custom_request_files").select("file_id,version_number").eq("custom_request_id", requestId), "member A file read");
const memberBFile = must(await memberBClient.database.from("custom_request_files").select("file_id").eq("custom_request_id", requestId), "member B file read");
assert(memberAFile.length === 1 && memberAFile[0].version_number === 1 && memberBFile.length === 0, "versioned files remain isolated across members");

const cancellableId = must(
  await memberAClient.database.rpc("create_custom_request_draft", {
    ...requestInput,
    item_name_input: "Cancellable custom item",
    description_input: "This second request verifies cancellation before conversion.",
  }),
  "create cancellable request",
);
must(await memberAClient.database.rpc("cancel_custom_request", {
  request_id_input: cancellableId, reason_input: "No longer required by the project.",
}), "cancel request before conversion");
const cancelled = must(await admin.database.from("custom_requests").select("status").eq("id", cancellableId).single(), "read cancelled request");
assert(cancelled.status === "CANCELLED", "member can cancel before conversion");

const directConversion = await admin.database
  .from("custom_requests")
  .update({ status: "CONVERTED" })
  .eq("id", requestId);
assert(
  Boolean(directConversion.error),
  "direct conversion is blocked until Slice 5 records an accepted quotation",
);

for (const line of results) console.log(line);
console.log(`Slice 4 branch integration complete: ${results.length} assertions`);
console.log(`Browser member: ${memberA.email}`);
console.log(`Browser admin: ${operator.email}`);
console.log(`Browser password: ${password}`);

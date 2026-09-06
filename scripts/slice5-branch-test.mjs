import { createAdminClient, createClient } from "@insforge/sdk";
import { getUatPassword } from "./uat-password.mjs";

const baseUrl = process.env.INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
if (!baseUrl || !apiKey || !anonKey) throw new Error("Slice 5 branch test environment is incomplete");

const admin = createAdminClient({ baseUrl, apiKey });
const password = getUatPassword();
const runId = Date.now();
const results = [];
const assert = (condition, label) => { if (!condition) throw new Error(`FAILED: ${label}`); results.push(`PASS: ${label}`); };
const must = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; };

async function createUser(prefix) {
  const email = `${prefix}.${runId}@example.com`;
  const created = must(await admin.auth.signUp({ email, password, name: prefix, autoConfirm: true }), `create ${prefix}`);
  let id = created?.user?.id;
  if (!id && created?.accessToken) {
    const temporary = createClient({ baseUrl, accessToken: created.accessToken, isServerMode: true });
    id = must(await temporary.auth.getCurrentUser(), `read ${prefix}`).user?.id;
  }
  if (!id) id = must(await admin.database.rpc("operator_find_auth_user_id", { email_input: email }), `lookup ${prefix}`);
  return { id, email };
}

async function signIn(user) {
  const client = createClient({ baseUrl, anonKey });
  must(await client.auth.signInWithPassword({ email: user.email, password }), `sign in ${user.email}`);
  return client;
}

async function onboard(client, suffix) {
  must(await client.database.rpc("save_member_onboarding", {
    contact_name_input: `Slice 5 Member ${suffix}`, contact_phone_input: "0800000000",
    company_name_input: `Slice 5 Member ${suffix} ${runId}`,
    company_legal_name_input: `Slice 5 Member ${suffix} ${runId} Co., Ltd.`,
    tax_id_input: `${suffix === "A" ? "06" : "07"}${String(runId).slice(-11)}`,
    business_type_input: "Interior Design", address_line_input: "Bangkok",
    district_input: "Pathum Wan", province_input: "Bangkok", postal_code_input: "10330",
    service_areas_input: ["Bangkok"], product_interests_input: ["Custom Furniture"],
    training_interest_input: false, training_note_input: null,
  }), `save onboarding ${suffix}`);
  return must(await client.database.rpc("submit_member_application", {}), `submit application ${suffix}`);
}

const operator = await createUser("slice5-admin");
let internalOrganization = must(await admin.database.from("organizations").select("id").eq("code", "GISP").maybeSingle(), "load GISP organization");
if (!internalOrganization) internalOrganization = must(await admin.database.from("organizations").insert([{
  code: "GISP", name: "Global Interior Supply Platform", status: "ACTIVE", approved_at: new Date().toISOString(),
}]).select("id"), "create GISP organization")[0];
must(await admin.database.from("users").insert([{ id: operator.id, primary_organization_id: internalOrganization.id, full_name: "Slice 5 Quotation Admin", status: "ACTIVE" }]), "create quotation admin");
const superRole = must(await admin.database.from("roles").select("id").eq("code", "SUPER_ADMIN").single(), "load Super Admin role");
must(await admin.database.from("user_roles").insert([{ user_id: operator.id, role_id: superRole.id, organization_id: null, assigned_by: operator.id }]), "assign quotation admin role");
const operatorClient = await signIn(operator);

const memberA = await createUser("slice5-member-a");
const memberB = await createUser("slice5-member-b");
const memberAClient = await signIn(memberA);
const memberBClient = await signIn(memberB);
const applicationA = await onboard(memberAClient, "A");
const applicationB = await onboard(memberBClient, "B");
must(await operatorClient.database.rpc("approve_member_application", { application_id_input: applicationA, review_note_input: "Slice 5 test" }), "approve member A");
must(await operatorClient.database.rpc("approve_member_application", { application_id_input: applicationB, review_note_input: "Slice 5 test" }), "approve member B");
const profiles = must(await admin.database.from("member_profiles").select("id,user_id,organization_id"), "load member profiles");
const profileA = profiles.find((row) => row.user_id === memberA.id);
const profileB = profiles.find((row) => row.user_id === memberB.id);
if (!profileA || !profileB) throw new Error("Approved member profiles are missing");

const project = must(await admin.database.from("projects").insert([{
  organization_id: profileA.organization_id, member_profile_id: profileA.id,
  project_number: `PRJ-S5-${runId}`, name: "Slice 5 Quotation Project", site_address: "Bangkok",
  expected_need_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10), created_by: memberA.id,
}]).select("id"), "create quotation project")[0];
const supplierId = must(await operatorClient.database.rpc("create_catalog_supplier", {
  code_input: `S5-${runId}`, name_input: "Slice 5 Quotation Supplier",
  legal_name_input: "Slice 5 Quotation Supplier Co., Ltd.", country_code_input: "TH",
  default_currency_input: "THB", contact_name_input: "Quotation Contact",
  contact_email_input: "", contact_phone_input: "", website_url_input: "", default_lead_time_days_input: 35,
}), "create supplier");
must(await operatorClient.database.rpc("activate_catalog_supplier", { supplier_id_input: supplierId }), "activate supplier");

const requestInput = {
  project_id_input: project.id, area_id_input: null, base_product_id_input: null,
  request_type_input: "BUILT_IN", item_name_input: "Custom oak reception counter",
  description_input: "Custom oak reception counter with concealed storage and confirmed dimensions.",
  width_mm_input: 3200, depth_mm_input: 800, height_mm_input: 1100,
  quantity_input: 2, unit_input: "EA", requested_material_input: "Oak veneer",
  requested_color_input: "Natural oak", requested_function_input: "Concealed storage", member_note_input: "Site measure confirmed",
};

async function readyRequest(suffix) {
  const requestId = must(await memberAClient.database.rpc("create_custom_request_draft", {
    ...requestInput, item_name_input: `${requestInput.item_name_input} ${suffix}`,
  }), `create request ${suffix}`);
  must(await memberAClient.database.rpc("submit_custom_request_v2", { request_id_input: requestId }), `submit request ${suffix}`);
  must(await operatorClient.database.rpc("admin_review_custom_request", {
    request_id_input: requestId, action_input: "START_REVIEW", message_input: "",
    assigned_to_input: operator.id, due_at_input: new Date(Date.now() + 2 * 86400000).toISOString(),
  }), `start review ${suffix}`);
  must(await operatorClient.database.rpc("admin_set_custom_request_candidates", { request_id_input: requestId, supplier_ids_input: [supplierId] }), `set candidate ${suffix}`);
  must(await operatorClient.database.rpc("admin_review_custom_request", {
    request_id_input: requestId, action_input: "READY_FOR_QUOTE", message_input: "Specification confirmed",
    assigned_to_input: null, due_at_input: null,
  }), `ready request ${suffix}`);
  return requestId;
}

const createQuote = (requestId, subtotal, note) => operatorClient.database.rpc("create_custom_quotation", {
  custom_request_id_input: requestId, subtotal_input: subtotal, lead_time_days_input: 45,
  valid_days_input: 30, supplier_id_input: supplierId, supplier_cost_total_input: subtotal * 0.6,
  quote_note_input: note, confirmed_specification_input: "Oak veneer reception counter, confirmed at 3200 × 800 × 1100 mm.",
});

const requestId = await readyRequest("main");
const quote1Id = must(await createQuote(requestId, 100000, "Revision 1"), "create quotation revision 1");
const quote1 = must(await operatorClient.database.from("custom_quotations").select("quotation_number,version,status,vat_rate,subtotal,vat_amount,grand_total").eq("id", quote1Id).single(), "read revision 1");
assert(quote1.version === 1 && quote1.status === "DRAFT" && Number(quote1.vat_amount) === 7000 && Number(quote1.grand_total) === 107000, "draft snapshots VAT with decimal-safe totals");
const hiddenDraft = must(await memberAClient.database.from("custom_quotations").select("id").eq("id", quote1Id), "member checks draft visibility");
assert(hiddenDraft.length === 0, "member cannot see quotation draft before GISP sends it");

must(await operatorClient.database.rpc("update_custom_quotation_draft", {
  quotation_id_input: quote1Id, subtotal_input: 110000, lead_time_days_input: 50,
  valid_days_input: 30, supplier_id_input: supplierId, supplier_cost_total_input: 65000,
  quote_note_input: "Revision 1 updated", confirmed_specification_input: "Confirmed oak reception counter with cable management and concealed storage.",
}), "update quotation draft");
must(await operatorClient.database.rpc("send_custom_quotation", { quotation_id_input: quote1Id }), "send revision 1");
const visibleSent = must(await memberAClient.database.from("custom_quotations").select("id,status,subtotal").eq("id", quote1Id), "member reads sent quote");
assert(visibleSent.length === 1 && visibleSent[0].status === "SENT" && Number(visibleSent[0].subtotal) === 110000, "member sees sent quotation snapshot");
const crossMember = must(await memberBClient.database.from("custom_quotations").select("id").eq("id", quote1Id), "cross-member quotation read");
assert(crossMember.length === 0, "RLS hides quotation across members");
const memberCosts = must(await memberAClient.database.from("custom_quotation_costs").select("quotation_id").eq("quotation_id", quote1Id), "member cost isolation read");
assert(memberCosts.length === 0, "supplier cost remains internal");

const quote2Id = must(await createQuote(requestId, 115000, "Revision 2"), "create quotation revision 2");
const revisions12 = must(await operatorClient.database.from("custom_quotations").select("id,quotation_number,version,status").eq("custom_request_id", requestId).order("version"), "read first two revisions");
assert(revisions12.length === 2 && revisions12[0].status === "SUPERSEDED" && revisions12[1].version === 2 && revisions12[0].quotation_number === revisions12[1].quotation_number, "new revision supersedes prior active version and keeps quotation number");
must(await operatorClient.database.rpc("send_custom_quotation", { quotation_id_input: quote2Id }), "send revision 2");
const crossResponse = await memberBClient.database.rpc("respond_custom_quotation", { quotation_id_input: quote2Id, response_input: "ACCEPTED", reason_input: "" });
assert(Boolean(crossResponse.error), "member cannot respond to another member quotation");
const rejected = must(await memberAClient.database.rpc("respond_custom_quotation", { quotation_id_input: quote2Id, response_input: "REJECTED", reason_input: "Please reduce lead time." }), "reject revision 2");
assert(rejected.status === "REJECTED", "member can reject with a reason");

const quote3Id = must(await createQuote(requestId, 120000, "Revision 3 final"), "create quotation revision 3");
must(await operatorClient.database.rpc("send_custom_quotation", { quotation_id_input: quote3Id }), "send revision 3");
const accepted = must(await memberAClient.database.rpc("respond_custom_quotation", { quotation_id_input: quote3Id, response_input: "ACCEPTED", reason_input: "" }), "accept revision 3");
assert(accepted.status === "ACCEPTED" && Boolean(accepted.project_item_id), "acceptance returns READY_TO_ORDER project item reference");
const [converted, projectItem] = await Promise.all([
  admin.database.from("custom_requests").select("status,converted_at,converted_by").eq("id", requestId).single(),
  admin.database.from("project_items").select("quotation_item_id,item_type,specification_snapshot,quantity,current_unit_price,vat_rate_snapshot,lead_time_days_snapshot,status").eq("id", accepted.project_item_id).single(),
]);
const convertedRow = must(converted, "read converted request");
const itemRow = must(projectItem, "read accepted project item");
assert(convertedRow.status === "CONVERTED" && Boolean(convertedRow.converted_at), "accepted quote converts custom request");
assert(itemRow.item_type === "CUSTOM" && itemRow.status === "READY_TO_ORDER" && Number(itemRow.vat_rate_snapshot) === 7 && itemRow.lead_time_days_snapshot === 45, "accepted quote creates locked READY_TO_ORDER snapshot");
const cancelConverted = await memberAClient.database.rpc("cancel_custom_request", {
  request_id_input: requestId,
  reason_input: "Attempt after accepted quotation conversion",
});
assert(Boolean(cancelConverted.error), "member cannot cancel after accepted quotation conversion");
const acceptedEdit = await operatorClient.database.rpc("update_custom_quotation_draft", {
  quotation_id_input: quote3Id, subtotal_input: 1, lead_time_days_input: 1, valid_days_input: 1,
  supplier_id_input: supplierId, supplier_cost_total_input: 1, quote_note_input: "tamper", confirmed_specification_input: "tamper accepted quotation",
});
assert(Boolean(acceptedEdit.error), "accepted quotation cannot be edited");
const acceptedItem = must(await admin.database.from("custom_quotation_items").select("id").eq("quotation_id", quote3Id).single(), "load accepted item");
const itemTamper = await admin.database.from("custom_quotation_items").update({ line_subtotal: 1 }).eq("id", acceptedItem.id);
assert(Boolean(itemTamper.error), "accepted quotation child snapshot is immutable");

const cancelRequestId = await readyRequest("cancel");
const cancelQuoteId = must(await createQuote(cancelRequestId, 50000, "Cancellation case"), "create cancellable quote");
must(await operatorClient.database.rpc("admin_transition_custom_quotation", { quotation_id_input: cancelQuoteId, action_input: "CANCEL", reason_input: "Scope withdrawn" }), "cancel quotation");
const cancelledQuote = must(await admin.database.from("custom_quotations").select("status,decision_reason").eq("id", cancelQuoteId).single(), "read cancelled quotation");
assert(cancelledQuote.status === "CANCELLED" && cancelledQuote.decision_reason === "Scope withdrawn", "admin cancellation records reason");

const expireRequestId = await readyRequest("expire");
const expireQuoteId = must(await createQuote(expireRequestId, 60000, "Expiry case"), "create expiring quote");
must(await operatorClient.database.rpc("send_custom_quotation", { quotation_id_input: expireQuoteId }), "send expiring quote");
must(await admin.database.from("custom_quotations").update({ valid_until: "2020-01-01" }).eq("id", expireQuoteId), "force past validity for isolated test");
must(await operatorClient.database.rpc("admin_transition_custom_quotation", { quotation_id_input: expireQuoteId, action_input: "EXPIRE", reason_input: "" }), "expire due quotation");
const expiredQuote = must(await admin.database.from("custom_quotations").select("status,expired_at").eq("id", expireQuoteId).single(), "read expired quotation");
assert(expiredQuote.status === "EXPIRED" && Boolean(expiredQuote.expired_at), "sent quotation transitions to EXPIRED");

for (const line of results) console.log(line);
console.log(`Slice 5 branch integration complete: ${results.length} assertions`);
console.log(`Browser member: ${memberA.email}`);
console.log(`Browser admin: ${operator.email}`);
console.log(`Browser password: ${password}`);

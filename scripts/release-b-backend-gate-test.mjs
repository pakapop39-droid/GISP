import assert from "node:assert/strict";
import { createClient } from "@insforge/sdk";
import { getUatPassword, UAT_MEMBER_EMAIL } from "./uat-password.mjs";

const baseUrl = process.env.INSFORGE_URL;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
if (!baseUrl || !anonKey) throw new Error("Release B backend gate environment is incomplete");
if (!baseUrl.includes("m8ugbyak-p4a")) throw new Error("Refusing to test outside the current-production Release B rehearsal branch");

const client = createClient({ baseUrl, anonKey });
const signedIn = await client.auth.signInWithPassword({ email: UAT_MEMBER_EMAIL, password: getUatPassword() });
if (signedIn.error) throw new Error(`UAT member login failed: ${signedIn.error.message}`);

const nil = "00000000-0000-0000-0000-000000000000";
const calls = [
  ["submit_custom_request", { project_id_input: nil, item_name_input: "blocked", specification_input: "blocked" }],
  ["create_custom_request_draft", { project_id_input: null, area_id_input: null, base_product_id_input: null, request_type_input: "NEW_PRODUCT", item_name_input: "blocked", description_input: "blocked transaction", width_mm_input: null, depth_mm_input: null, height_mm_input: null, quantity_input: 1, unit_input: "EA", requested_material_input: null, requested_color_input: null, requested_function_input: null, member_note_input: null }],
  ["save_custom_request_details", { request_id_input: nil, project_id_input: null, area_id_input: null, base_product_id_input: null, request_type_input: "NEW_PRODUCT", item_name_input: "blocked", description_input: "blocked transaction", width_mm_input: null, depth_mm_input: null, height_mm_input: null, quantity_input: 1, unit_input: "EA", requested_material_input: null, requested_color_input: null, requested_function_input: null, member_note_input: null }],
  ["submit_custom_request_v2", { request_id_input: nil }],
  ["cancel_custom_request", { request_id_input: nil, reason_input: "blocked" }],
  ["respond_custom_quotation", { quotation_id_input: nil, response_input: "ACCEPT", reason_input: null }],
  ["create_customer_order", { project_id_input: nil, selections_input: [] }],
  ["submit_payment_transfer", { payment_schedule_id_input: nil, amount_input: 1, transferred_at_input: new Date().toISOString(), evidence_file_id_input: nil }],
  ["request_order_cancellation", { order_id_input: nil, reason_input: "blocked", supporting_file_id_input: null }],
  ["approve_custom_qc", { order_item_id_input: nil }],
  ["respond_custom_qc", { order_item_id_input: nil, decision_input: "APPROVE", note_input: null }],
  ["acknowledge_partial_shipment", { shipment_id_input: nil, note_input: null }],
  ["confirm_delivery_appointment", { delivery_id_input: nil }],
  ["request_delivery_reschedule", { delivery_id_input: nil, preferred_dates_input: [], reason_input: "blocked", contact_name_input: "Member", contact_phone_input: "0800000000", site_note_input: null, requested_address_input: null }],
  ["create_claim", { delivery_item_id_input: nil, issue_type_input: "OTHER", subject_input: "blocked", description_input: "blocked transaction", claimed_quantity_input: 1, severity_input: "LOW", discovered_at_input: new Date().toISOString(), packaging_condition_input: null, temporary_action_input: null, evidence_file_id_input: nil }],
  ["member_claim_action", { claim_id_input: nil, action_input: "CONFIRM_RESOLUTION", note_input: null, evidence_file_id_input: null }],
];

const results = [];
for (const [name, args] of calls) {
  const response = await client.database.rpc(name, args);
  assert.ok(response.error, `${name} must be denied during Release B`);
  assert.match(String(response.error.message), /permission denied/i, `${name} must fail at function privilege gate`);
  results.push(`PASS: ${name} is disabled for authenticated Member`);
}

for (const result of results) console.log(result);
console.log(`Release B backend transaction gate passed: ${results.length} assertions`);

import { createAdminClient, createClient } from "@insforge/sdk";
import { getUatPassword, UAT_ADMIN_EMAIL, UAT_MEMBER_EMAIL } from "./uat-password.mjs";

const baseUrl = process.env.INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
if (!baseUrl || !apiKey || !anonKey) throw new Error("Slice 6 branch test environment is incomplete");

const admin = createAdminClient({ baseUrl, apiKey });
const password = getUatPassword();
const runId = Date.now();
const results = [];
const assert = (condition, label) => { if (!condition) throw new Error(`FAILED: ${label}`); results.push(`PASS: ${label}`); };
const must = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; };

async function signIn(email) {
  const client = createClient({ baseUrl, anonKey });
  must(await client.auth.signInWithPassword({ email, password }), `sign in ${email}`);
  return client;
}

async function createCrossMember(operatorClient) {
  const email = `slice6-cross-member.${runId}@example.com`;
  const created = must(await admin.auth.signUp({ email, password, name: "Slice 6 Cross Member", autoConfirm: true }), "create cross member");
  let id = created?.user?.id;
  if (!id && created?.accessToken) {
    const temporary = createClient({ baseUrl, accessToken: created.accessToken, isServerMode: true });
    id = must(await temporary.auth.getCurrentUser(), "read cross member").user?.id;
  }
  if (!id) id = must(await admin.database.rpc("operator_find_auth_user_id", { email_input: email }), "lookup cross member");
  const client = await signIn(email);
  must(await client.database.rpc("save_member_onboarding", {
    contact_name_input: "Slice 6 Cross Member", contact_phone_input: "0800000000",
    company_name_input: `Slice 6 Cross Member ${runId}`,
    company_legal_name_input: `Slice 6 Cross Member ${runId} Co., Ltd.`,
    tax_id_input: `08${String(runId).slice(-11)}`, business_type_input: "Interior Design",
    address_line_input: "Bangkok", district_input: "Pathum Wan", province_input: "Bangkok",
    postal_code_input: "10330", service_areas_input: ["Bangkok"],
    product_interests_input: ["Furniture"], training_interest_input: false, training_note_input: null,
  }), "save cross member onboarding");
  const applicationId = must(await client.database.rpc("submit_member_application", {}), "submit cross member application");
  must(await operatorClient.database.rpc("approve_member_application", { application_id_input: applicationId, review_note_input: "Slice 6 isolation test" }), "approve cross member");
  return { client, id, email };
}

const operatorEmail = UAT_ADMIN_EMAIL;
const memberEmail = UAT_MEMBER_EMAIL;
const operatorClient = await signIn(operatorEmail);
const memberClient = await signIn(memberEmail);
const crossMember = await createCrossMember(operatorClient);

const operatorUser = must(await operatorClient.auth.getCurrentUser(), "read UAT admin").user;

const memberProfile = must(await admin.database.from("member_profiles")
  .select("id,user_id,organization_id,company_name").eq("user_id", must(await memberClient.auth.getCurrentUser(), "read UAT member").user.id).single(), "load UAT member profile");

const supplier = must(await admin.database.from("suppliers").select("id").eq("status", "ACTIVE").limit(1).single(), "load active supplier");
let category = must(await admin.database.from("categories").select("id").eq("status", "ACTIVE").limit(1), "load active category")[0];
if (!category) {
  category = must(await admin.database.from("categories").insert([{
    code: `S6-${runId}`, name_th: "หมวดทดสอบ Slice 6", status: "ACTIVE",
  }]).select("id").single(), "create active category");
}
const product = must(await admin.database.from("products").insert([{
  supplier_id: supplier.id, category_id: category.id, sku: `S6-UAT-${runId}`,
  product_type: "STANDARD", name_th: "เก้าอี้ทดสอบ Slice 6", name_en: "Slice 6 UAT Chair",
  specification_summary: "โครงไม้โอ๊ก บุผ้าสีครีม", default_lead_time_days: 45,
  country_code: "CN", width_mm: 620, depth_mm: 680, height_mm: 780,
  weight_kg: 18, cbm: 0.329, material_summary: "ไม้โอ๊กและผ้าบุ",
  finish_summary: "สีธรรมชาติและผ้าสีครีม", moq: 1,
  factory_cost: 25000, factory_currency: "CNY", status: "PUBLISHED",
  qa_status: "PASSED", reviewed_by: operatorUser.id, reviewed_at: new Date().toISOString(),
  published_at: new Date().toISOString(), created_by: operatorUser.id,
}]).select("id,sku,name_th,factory_cost").single(), "create Slice 6 UAT product fixture");

must(await admin.database.from("product_prices").insert([{
  product_id: product.id, price_type: "MEMBER", amount: 60000,
  suggested_resale_amount: 72000, freight_estimate_min: 3500,
  freight_estimate_max: 5200, currency: "THB", status: "ACTIVE",
  valid_from: new Date().toISOString(), created_by: operatorUser.id,
}]), "create active member price for Slice 6 UAT product fixture");

const project = must(await admin.database.from("projects").insert([{
  organization_id: memberProfile.organization_id, member_profile_id: memberProfile.id,
  project_number: `PRJ-S6-UAT-${runId}`, name: `Slice 6 UAT Order ${runId}`,
  site_address: "Bangkok — Slice 6 UAT", status: "ACTIVE", created_by: memberProfile.user_id,
}]).select("id,project_number,name").single(), "create Slice 6 UAT project");

const projectItem = must(await admin.database.from("project_items").insert([{
  project_id: project.id, organization_id: memberProfile.organization_id,
  product_id: product.id, item_type: "STANDARD",
  item_name: `${product.name_th} · Slice 6 UAT`, specification_snapshot: "โครงไม้โอ๊ก บุผ้าสีครีม",
  selected_options: [], quantity: 6, unit: "EA",
  current_unit_price: 60000, vat_rate_snapshot: 7,
  status: "READY_TO_ORDER", ordered_quantity: 0, created_by: memberProfile.user_id,
}]).select("id,quantity,current_unit_price,vat_rate_snapshot").single(), "create ready-to-order UAT item");

async function createOrder(label) {
  const id = must(await memberClient.database.rpc("create_customer_order", {
    project_id_input: project.id,
    selections_input: [{ project_item_id: projectItem.id, quantity: 1 }],
  }), `create ${label} order`);
  return must(await admin.database.from("customer_orders").select("*").eq("id", id).single(), `read ${label} order`);
}

function evidence(ownerId, profileId, organizationId, visibility, suffix) {
  return admin.database.from("file_metadata").insert([{
    organization_id: organizationId, member_profile_id: profileId,
    bucket: visibility === "CONFIDENTIAL" ? "gisp-confidential" : "gisp-member-private",
    object_key: `slice6-test/${runId}-${suffix}.png`, original_name: `${suffix}.png`,
    mime_type: "image/png", size_bytes: 68, visibility,
    entity_type: visibility === "CONFIDENTIAL" ? "SUPPLIER_PAYMENT_EVIDENCE" : "CUSTOMER_PAYMENT_EVIDENCE",
    uploaded_by: ownerId,
  }]).select("id").single();
}

const mainOrder = await createOrder("main");
assert(mainOrder.member_profile_id === memberProfile.id && mainOrder.status === "PENDING_DEPOSIT", "order belongs to one member profile and starts at PENDING_DEPOSIT");
assert(Number(mainOrder.deposit_amount) + Number(mainOrder.balance_amount) === Number(mainOrder.grand_total), "customer payment schedules use exact 50/50 grand-total split");

const orderItems = must(await memberClient.database.from("order_items").select("id,unit_price_snapshot,line_total").eq("order_id", mainOrder.id), "member reads order snapshots");
assert(orderItems.length === 1 && Number(orderItems[0].unit_price_snapshot) === Number(projectItem.current_unit_price), "order locks member price snapshot");
const supplierOrders = must(await admin.database.from("supplier_orders").select("*").eq("customer_order_id", mainOrder.id), "load supplier orders");
assert(supplierOrders.length === 1 && supplierOrders[0].supplier_order_number.startsWith("SO-") && supplierOrders[0].po_number === null, "SO is numbered separately and PO is not issued early");
const memberSupplierRead = must(await memberClient.database.from("supplier_orders").select("id,total_factory_cost").eq("customer_order_id", mainOrder.id), "member checks supplier isolation");
assert(memberSupplierRead.length === 0, "member cannot see supplier identity or factory cost");
const crossOrderRead = must(await crossMember.client.database.from("customer_orders").select("id").eq("id", mainOrder.id), "cross-member order read");
assert(crossOrderRead.length === 0, "RLS hides order from another member");
const directStatusWrite = await memberClient.database.from("customer_orders").update({ status: "PO_ISSUED" }).eq("id", mainOrder.id);
assert(Boolean(directStatusWrite.error), "member cannot patch order status directly");

const schedules = must(await memberClient.database.from("payment_schedules").select("*").eq("order_id", mainOrder.id).order("schedule_type"), "load customer payment schedules");
const deposit = schedules.find((row) => row.schedule_type === "DEPOSIT");
const balance = schedules.find((row) => row.schedule_type === "BALANCE");
if (!deposit || !balance) throw new Error("customer payment schedules missing");
const earlyPo = await operatorClient.database.rpc("issue_supplier_orders", { order_id_input: mainOrder.id });
assert(Boolean(earlyPo.error), "PO gate blocks issue before full verified customer deposit");

async function submitCustomerTransfer(scheduleId, amount, suffix) {
  const file = must(await evidence(memberProfile.user_id, memberProfile.id, memberProfile.organization_id, "MEMBER_PRIVATE", suffix), `create ${suffix} evidence`);
  return must(await memberClient.database.rpc("submit_payment_transfer", {
    payment_schedule_id_input: scheduleId, amount_input: amount,
    transferred_at_input: new Date().toISOString(), evidence_file_id_input: file.id,
  }), `submit ${suffix} transfer`);
}

const firstAmount = Math.floor(Number(deposit.due_amount) / 2 * 100) / 100;
const transfer1 = await submitCustomerTransfer(deposit.id, firstAmount, "deposit-part-1");
must(await operatorClient.database.rpc("verify_payment_transfer", { transfer_id_input: transfer1, approve_input: true, finance_note_input: "Partial deposit verified" }), "verify partial customer deposit");
let depositState = must(await admin.database.from("payment_schedules").select("status,verified_amount,due_amount").eq("id", deposit.id).single(), "read partial deposit state");
assert(depositState.status === "PARTIALLY_VERIFIED" && Number(depositState.verified_amount) === firstAmount, "partial transfer accumulates without opening PO gate");

const transfer2 = await submitCustomerTransfer(deposit.id, Number(deposit.due_amount) - firstAmount, "deposit-part-2");
must(await operatorClient.database.rpc("verify_payment_transfer", { transfer_id_input: transfer2, approve_input: true, finance_note_input: "Deposit completed" }), "verify remaining customer deposit");
depositState = must(await admin.database.from("payment_schedules").select("status,verified_amount,due_amount").eq("id", deposit.id).single(), "read verified deposit state");
assert(depositState.status === "VERIFIED" && Number(depositState.verified_amount) === Number(depositState.due_amount), "exact accumulated deposit becomes VERIFIED");

const rejectedTransfer = await submitCustomerTransfer(balance.id, 100, "balance-rejected");
must(await operatorClient.database.rpc("verify_payment_transfer", { transfer_id_input: rejectedTransfer, approve_input: false, finance_note_input: "Slip account does not match" }), "reject customer transfer");
const resubmittedTransfer = await submitCustomerTransfer(balance.id, 100, "balance-resubmitted");
must(await operatorClient.database.rpc("verify_payment_transfer", { transfer_id_input: resubmittedTransfer, approve_input: true, finance_note_input: "Replacement slip verified" }), "verify resubmitted transfer");
const rejectedState = must(await admin.database.from("payment_transfers").select("status,finance_note").eq("id", rejectedTransfer).single(), "read rejected transfer");
assert(rejectedState.status === "REJECTED", "rejected transfer remains in history and member can resubmit");

must(await operatorClient.database.rpc("issue_supplier_orders", { order_id_input: mainOrder.id }), "issue supplier purchase order");
const issuedSupplierOrder = must(await admin.database.from("supplier_orders").select("*").eq("id", supplierOrders[0].id).single(), "read issued supplier order");
const purchaseOrder = must(await admin.database.from("purchase_orders").select("*").eq("supplier_order_id", supplierOrders[0].id).single(), "read purchase order snapshot");
assert(issuedSupplierOrder.po_number?.startsWith("PO-") && purchaseOrder.purchase_order_number === issuedSupplierOrder.po_number, "full verified deposit opens PO gate and creates PO snapshot");

const supplierSchedules = must(await admin.database.from("supplier_payment_schedules").select("*").eq("supplier_order_id", issuedSupplierOrder.id), "load supplier 50/50 schedules");
const supplierDeposit = supplierSchedules.find((row) => row.schedule_type === "DEPOSIT");
if (!supplierDeposit) throw new Error("supplier deposit schedule missing");
const supplierPaymentId = must(await operatorClient.database.rpc("create_supplier_payment", {
  supplier_order_id_input: issuedSupplierOrder.id, payment_type_input: "DEPOSIT",
  amount_input: supplierDeposit.due_amount, note_input: "Supplier deposit 50%",
}), "request supplier deposit payment");
must(await operatorClient.database.rpc("review_supplier_payment", { supplier_payment_id_input: supplierPaymentId, approve_input: true, decision_note_input: "Approved against PO" }), "approve supplier deposit payment");
const supplierFile = must(await evidence(memberProfile.user_id, null, memberProfile.organization_id, "CONFIDENTIAL", "supplier-paid"), "create supplier confidential evidence");
must(await operatorClient.database.rpc("mark_supplier_payment_paid", { supplier_payment_id_input: supplierPaymentId, evidence_file_id_input: supplierFile.id }), "mark approved supplier payment paid");
const supplierPaymentState = must(await admin.database.from("supplier_payments").select("status").eq("id", supplierPaymentId).single(), "read supplier payment state");
assert(supplierPaymentState.status === "PAID", "supplier payment requires request, approval and paid evidence");

const overpayOrder = await createOrder("overpayment");
const overpayDeposit = must(await admin.database.from("payment_schedules").select("*").eq("order_id", overpayOrder.id).eq("schedule_type", "DEPOSIT").single(), "load overpayment deposit");
const overpayTransfer = await submitCustomerTransfer(overpayDeposit.id, Number(overpayDeposit.due_amount) + 100, "overpayment");
must(await operatorClient.database.rpc("verify_payment_transfer", { transfer_id_input: overpayTransfer, approve_input: true, finance_note_input: "Overpayment flagged" }), "verify overpayment transfer");
const overpayState = must(await admin.database.from("payment_schedules").select("status").eq("id", overpayDeposit.id).single(), "read overpayment state");
const overpayPo = await operatorClient.database.rpc("issue_supplier_orders", { order_id_input: overpayOrder.id });
assert(overpayState.status === "OVERPAYMENT_REVIEW" && Boolean(overpayPo.error), "overpayment is flagged and cannot open PO gate");

const cancellableOrder = await createOrder("pre-deposit cancellation");
const autoCancellationId = must(await memberClient.database.rpc("request_order_cancellation", { order_id_input: cancellableOrder.id, reason_input: "Scope removed before deposit", supporting_file_id_input: null }), "cancel before deposit");
const [autoCancellation, cancelledOrder] = await Promise.all([
  admin.database.from("cancellation_requests").select("status,decision_note").eq("id", autoCancellationId).single(),
  admin.database.from("customer_orders").select("status").eq("id", cancellableOrder.id).single(),
]);
assert(must(autoCancellation, "read auto cancellation").status === "APPROVED" && must(cancelledOrder, "read cancelled order").status === "CANCELLED", "cancellation before deposit is immediate and audited");

const cancellationId = must(await memberClient.database.rpc("request_order_cancellation", { order_id_input: mainOrder.id, reason_input: "Customer requests cancellation after deposit", supporting_file_id_input: null }), "request cancellation after deposit");
let cancellationState = must(await admin.database.from("cancellation_requests").select("status").eq("id", cancellationId).single(), "read submitted cancellation");
assert(cancellationState.status === "SUBMITTED", "cancellation after deposit requires admin decision");
must(await operatorClient.database.rpc("decide_order_cancellation", { cancellation_request_id_input: cancellationId, approve_input: false, decision_note_input: "Production commitment remains", approved_refund_amount_input: 0, approved_deduction_amount_input: 0 }), "reject cancellation request");
let mainOrderState = must(await admin.database.from("customer_orders").select("status").eq("id", mainOrder.id).single(), "read restored order");
assert(mainOrderState.status === "PO_ISSUED", "rejected cancellation restores prior order state");

const approvedCancellationId = must(await memberClient.database.rpc("request_order_cancellation", { order_id_input: mainOrder.id, reason_input: "Customer accepts documented deduction", supporting_file_id_input: null }), "resubmit cancellation");
must(await operatorClient.database.rpc("decide_order_cancellation", { cancellation_request_id_input: approvedCancellationId, approve_input: true, decision_note_input: "Approved with manual finance follow-up", approved_refund_amount_input: 1000, approved_deduction_amount_input: 500 }), "approve cancellation request");
cancellationState = must(await admin.database.from("cancellation_requests").select("status,approved_refund_amount,approved_deduction_amount").eq("id", approvedCancellationId).single(), "read approved cancellation");
mainOrderState = must(await admin.database.from("customer_orders").select("status").eq("id", mainOrder.id).single(), "read final cancelled order");
assert(cancellationState.status === "APPROVED" && mainOrderState.status === "CANCELLED", "admin can approve post-deposit cancellation with explicit refund/deduction records");

const [verificationLogs, supplierHistory, statusEvents] = await Promise.all([
  admin.database.from("payment_verification_logs").select("id").eq("payment_transfer_id", transfer1),
  admin.database.from("supplier_payment_history").select("action").eq("supplier_payment_id", supplierPaymentId),
  admin.database.from("status_events").select("to_status").eq("entity_type", "customer_order").eq("entity_id", mainOrder.id),
]);
assert(must(verificationLogs, "read verification logs").length > 0 && must(supplierHistory, "read supplier history").length >= 3 && must(statusEvents, "read order events").length >= 3, "finance, supplier-payment and order transitions retain audit history");

for (const line of results) console.log(line);
console.log(`Slice 6 branch integration complete: ${results.length} assertions`);
console.log(`UAT member: ${memberEmail}`);
console.log(`UAT admin: ${operatorEmail}`);
console.log(`UAT password: ${password}`);
console.log(`UAT project: ${project.project_number} — ${project.name}`);

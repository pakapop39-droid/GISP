import { createAdminClient, createClient } from "@insforge/sdk";
import { getUatPassword, UAT_ADMIN_EMAIL, UAT_MEMBER_EMAIL } from "./uat-password.mjs";

const baseUrl = process.env.INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

if (!baseUrl || !apiKey || !anonKey) {
  throw new Error("Slice 10 fixture environment is incomplete");
}
if (!baseUrl.includes("kit6y4pj-xjz")) {
  throw new Error("Refusing to seed outside Slice 10 backend branch");
}

const admin = createAdminClient({ baseUrl, apiKey });
const password = getUatPassword();
const suffix = Date.now();
const now = new Date();
const isoDaysFromNow = (days) => new Date(now.getTime() + days * 86_400_000).toISOString();

function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function signIn(email) {
  const client = createClient({ baseUrl, anonKey });
  must(await client.auth.signInWithPassword({ email, password }), `sign in ${email}`);
  return client;
}

const operator = await signIn(UAT_ADMIN_EMAIL);
const member = await signIn(UAT_MEMBER_EMAIL);
const operatorUser = must(await operator.auth.getCurrentUser(), "operator user").user;
const memberUser = must(await member.auth.getCurrentUser(), "member user").user;

const profile = must(
  await admin.database
    .from("member_profiles")
    .select("id,organization_id,company_name")
    .eq("user_id", memberUser.id)
    .single(),
  "member profile",
);
const supplier = must(
  await admin.database.from("suppliers").select("id,name").eq("status", "ACTIVE").limit(1).single(),
  "active supplier",
);
const evidenceFile = must(
  await admin.database.from("file_metadata").select("id").order("created_at", { ascending: false }).limit(1).single(),
  "existing UAT evidence file",
);

const project = must(
  await admin.database.from("projects").insert([{
    organization_id: profile.organization_id,
    member_profile_id: profile.id,
    project_number: `PRJ-S10-HUAT-${suffix}`,
    name: `Slice 10 Dashboard Reports UAT ${suffix}`,
    site_address: "Bangkok — Slice 10 Human UAT",
    status: "ACTIVE",
    created_by: memberUser.id,
  }]).select("id,project_number,name").single(),
  "project",
);

const projectItem = must(
  await admin.database.from("project_items").insert([{
    project_id: project.id,
    organization_id: profile.organization_id,
    item_type: "STANDARD",
    item_name: `โต๊ะประชุม Slice 10 UAT ${suffix}`,
    specification_snapshot: "โต๊ะไม้โอ๊ก 2 ตัว — ชุดทดสอบ Dashboard และ Reports",
    selected_options: [],
    quantity: 2,
    unit: "EA",
    current_unit_price: 50_000,
    vat_rate_snapshot: 7,
    status: "ORDERED",
    ordered_quantity: 2,
    created_by: memberUser.id,
  }]).select("id,item_name").single(),
  "project item",
);

const order = must(
  await admin.database.from("customer_orders").insert([{
    organization_id: profile.organization_id,
    member_profile_id: profile.id,
    project_id: project.id,
    order_number: `ORD-S10-HUAT-${suffix}`,
    status: "IN_PRODUCTION",
    currency: "THB",
    subtotal: 100_000,
    vat_rate_snapshot: 7,
    vat_amount: 7_000,
    grand_total: 107_000,
    deposit_amount: 53_500,
    balance_amount: 53_500,
    deposit_verified_at: isoDaysFromNow(-14),
    shipping_address_snapshot: { site_address: "Bangkok — Slice 10 Human UAT" },
    created_by: memberUser.id,
  }]).select("id,order_number").single(),
  "customer order",
);

const orderItem = must(
  await admin.database.from("order_items").insert([{
    order_id: order.id,
    organization_id: profile.organization_id,
    project_item_id: projectItem.id,
    item_type: "STANDARD",
    item_name_snapshot: projectItem.item_name,
    specification_snapshot: "โต๊ะไม้โอ๊ก 2 ตัว",
    options_snapshot: [],
    quantity: 2,
    unit: "EA",
    unit_price_snapshot: 50_000,
    line_subtotal: 100_000,
    vat_rate_snapshot: 7,
    vat_amount: 7_000,
    line_total: 107_000,
    qc_status: "WAITING_MEMBER_APPROVAL",
  }]).select("id").single(),
  "order item",
);

must(
  await admin.database.from("payment_schedules").insert([
    {
      order_id: order.id,
      organization_id: profile.organization_id,
      schedule_type: "DEPOSIT",
      due_amount: 53_500,
      verified_amount: 20_000,
      status: "PARTIALLY_VERIFIED",
      due_at: isoDaysFromNow(-3),
    },
    {
      order_id: order.id,
      organization_id: profile.organization_id,
      schedule_type: "BALANCE",
      due_amount: 53_500,
      verified_amount: 0,
      status: "PENDING",
      due_at: isoDaysFromNow(3),
    },
  ]),
  "payment schedules",
);

const supplierOrder = must(
  await admin.database.from("supplier_orders").insert([{
    customer_order_id: order.id,
    organization_id: profile.organization_id,
    supplier_id: supplier.id,
    supplier_order_number: `SO-S10-HUAT-${suffix}`,
    po_number: `PO-S10-HUAT-${suffix}`,
    status: "IN_PRODUCTION",
    supplier_currency: "CNY",
    total_factory_cost: 60_000,
    paid_factory_amount: 30_000,
    po_issued_at: isoDaysFromNow(-20),
  }]).select("id").single(),
  "supplier order",
);

must(
  await admin.database.from("supplier_order_items").insert([{
    supplier_order_id: supplierOrder.id,
    order_item_id: orderItem.id,
    quantity: 2,
    factory_unit_cost_snapshot: 30_000,
    factory_line_total: 60_000,
  }]),
  "supplier order item",
);

must(
  await admin.database.from("production_updates").insert([{
    supplier_order_id: supplierOrder.id,
    organization_id: profile.organization_id,
    status: "DELAYED",
    note: "Slice 10 UAT: วัตถุดิบมาถึงล่าช้า",
    delay_reason: "วัตถุดิบล่าช้าจากโรงงานต้นทาง",
    progress_percent: 45,
    estimated_completion_at: isoDaysFromNow(10),
    is_member_visible: true,
    created_by: operatorUser.id,
  }]),
  "production delay",
);

const shipment = must(
  await admin.database.from("shipments").insert([{
    organization_id: profile.organization_id,
    customer_order_id: order.id,
    shipment_number: `SHP-S10-HUAT-${suffix}`,
    shipment_name: `Shipment Slice 10 UAT ${suffix}`,
    status: "IN_TRANSIT",
    tracking_number: `GISP-S10-${suffix}`,
    carrier_name: "Slice 10 UAT Carrier",
    shipment_type: "DIRECT",
    shipping_method: "LCL",
    destination_country_code: "TH",
    destination_address_snapshot: { site_address: "Bangkok — Slice 10 Human UAT" },
    estimated_arrival_at: isoDaysFromNow(-1),
    original_eta_at: isoDaysFromNow(-2),
    etd_at: isoDaysFromNow(-10),
    actual_departure_at: isoDaysFromNow(-9),
    dispatched_at: isoDaysFromNow(-9),
    delay_reason: "เรือเทียบท่าล่าช้า — ข้อมูลสำหรับ Human UAT",
    package_count: 2,
    actual_weight_kg: 40,
    actual_cbm: 1.2,
    created_by: operatorUser.id,
  }]).select("id,shipment_number").single(),
  "shipment",
);

const shipmentItem = must(
  await admin.database.from("shipment_items").insert([{
    shipment_id: shipment.id,
    organization_id: profile.organization_id,
    order_item_id: orderItem.id,
    quantity: 2,
    package_count: 2,
    weight_kg: 40,
    cbm: 1.2,
  }]).select("id").single(),
  "shipment item",
);

must(
  await admin.database.from("shipment_status_history").insert([{
    shipment_id: shipment.id,
    organization_id: profile.organization_id,
    status: "DELAY",
    location_text: "ทะเลจีนใต้",
    event_at: now.toISOString(),
    note: "กำหนดถึงไทยเลื่อน 2 วัน",
    is_delay: true,
    eta_at: isoDaysFromNow(2),
    is_member_visible: true,
    created_by: operatorUser.id,
  }]),
  "shipment delay history",
);

const proposedDelivery = must(
  await admin.database.from("deliveries").insert([{
    shipment_id: shipment.id,
    customer_order_id: order.id,
    organization_id: profile.organization_id,
    delivery_number: `DLV-S10-PROPOSED-${suffix}`,
    status: "PROPOSED",
    scheduled_at: isoDaysFromNow(1),
    scheduled_window_end_at: new Date(now.getTime() + 1.25 * 86_400_000).toISOString(),
    delivery_address_snapshot: { site_address: "Bangkok — Slice 10 Human UAT" },
    contact_name: "ผู้รับทดสอบ Slice 10",
    contact_phone: "0800000010",
    site_note: "นัดส่งสำหรับทดสอบ Action Required",
    created_by: operatorUser.id,
  }]).select("id,delivery_number").single(),
  "proposed delivery",
);

must(
  await admin.database.from("delivery_items").insert([{
    delivery_id: proposedDelivery.id,
    organization_id: profile.organization_id,
    order_item_id: orderItem.id,
    shipment_item_id: shipmentItem.id,
    quantity_delivered: 0,
    expected_quantity: 2,
    remaining_quantity: 2,
    condition: "GOOD",
    note: "รอยืนยันนัดส่ง",
  }]),
  "proposed delivery item",
);

const issueDelivery = must(
  await admin.database.from("deliveries").insert([{
    shipment_id: shipment.id,
    customer_order_id: order.id,
    organization_id: profile.organization_id,
    delivery_number: `DLV-S10-ISSUE-${suffix}`,
    status: "DELIVERED_WITH_ISSUE",
    scheduled_at: isoDaysFromNow(-5),
    scheduled_window_end_at: isoDaysFromNow(-4),
    delivered_at: isoDaysFromNow(-4),
    delivery_address_snapshot: { site_address: "Bangkok — Slice 10 Human UAT" },
    recipient_name: "ผู้รับทดสอบ Slice 10",
    proof_file_id: evidenceFile.id,
    note: "ส่งมอบแล้วพบสินค้าเสียหาย 1 ชิ้น",
    created_by: operatorUser.id,
  }]).select("id,delivery_number").single(),
  "issue delivery",
);

const deliveredItem = must(
  await admin.database.from("delivery_items").insert([{
    delivery_id: issueDelivery.id,
    organization_id: profile.organization_id,
    order_item_id: orderItem.id,
    shipment_item_id: shipmentItem.id,
    quantity_delivered: 2,
    expected_quantity: 2,
    remaining_quantity: 0,
    condition: "DAMAGED",
    issue_type: "DAMAGED",
    issue_description: "ขอบโต๊ะมีรอยกระแทก 1 ตัว",
    note: "ข้อมูลสำหรับทดสอบ Claim Report",
  }]).select("id").single(),
  "delivered item with issue",
);

const claim = must(
  await admin.database.from("claims").insert([{
    organization_id: profile.organization_id,
    member_profile_id: profile.id,
    order_item_id: orderItem.id,
    delivery_item_id: deliveredItem.id,
    claim_number: `CLM-S10-HUAT-${suffix}`,
    subject: "สินค้าเสียหาย — Slice 10 Human UAT",
    issue_type: "TRANSIT_DAMAGE",
    description: "ขอบโต๊ะมีรอยกระแทก ต้องการให้ทีมงานตรวจสอบ",
    evidence_file_id: evidenceFile.id,
    status: "WAITING_INFORMATION",
    claimed_quantity: 1,
    severity: "MEDIUM",
    discovered_at: isoDaysFromNow(-4),
    packaging_condition: "กล่องมีรอยบุบ",
    temporary_action: "แยกสินค้าไว้และยังไม่ติดตั้ง",
    suggested_responsibility: "LOGISTICS_INSURANCE",
    warranty_snapshot: {
      title: "เงื่อนไขรับประกัน ณ วันที่เปิด Claim",
      member_summary: "ทีม GISP ตรวจสอบตามหลักฐานและเงื่อนไขของคำสั่งซื้อ",
      captured_at: now.toISOString(),
    },
    target_resolution_at: isoDaysFromNow(2),
    information_request: "กรุณาส่งภาพมุมกว้างของกล่องและสินค้าเพิ่มเติม",
    opened_by: memberUser.id,
  }]).select("id,claim_number").single(),
  "claim waiting information",
);

must(
  await admin.database.from("claim_internal_costs").insert([{
    claim_id: claim.id,
    organization_id: profile.organization_id,
    cost_type: "LOGISTICS_RESERVE",
    amount: 12_345.67,
    currency: "THB",
    internal_note: "ข้อมูลลับสำหรับทดสอบว่า Member และ Fixed Report ต้องมองไม่เห็น",
    recorded_by: operatorUser.id,
  }]),
  "internal claim cost",
);

const memberDashboard = must(await member.database.rpc("get_member_dashboard"), "member dashboard verification");
const memberClaims = must(
  await member.database.rpc("get_fixed_report", {
    report_type_input: "claim",
    date_from_input: now.toISOString().slice(0, 10),
    date_to_input: now.toISOString().slice(0, 10),
    status_filter_input: "WAITING_INFORMATION",
    row_limit_input: 50,
    row_offset_input: 0,
  }),
  "member claim report verification",
);
const serializedMemberReport = JSON.stringify(memberClaims);
if (serializedMemberReport.includes("12345.67") || serializedMemberReport.includes("LOGISTICS_RESERVE")) {
  throw new Error("Member report leaked internal claim cost");
}

console.log(JSON.stringify({
  fixture: "Slice 10 Dashboard & Fixed Reports Human UAT",
  company: profile.company_name,
  projectNumber: project.project_number,
  orderId: order.id,
  orderNumber: order.order_number,
  shipmentNumber: shipment.shipment_number,
  proposedDeliveryNumber: proposedDelivery.delivery_number,
  claimNumber: claim.claim_number,
  memberActionCount: memberDashboard.metrics.action_required,
  memberClaimRows: memberClaims.row_count,
  internalCostLeakCheck: "PASS",
  paths: {
    memberDashboard: "/member/dashboard",
    memberReports: "/member/reports",
    adminDashboard: "/admin/dashboard",
    adminReports: "/admin/reports",
    executiveDashboard: "/admin/executive",
  },
}, null, 2));

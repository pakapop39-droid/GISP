import "server-only";

import { AppAccessError, requireAppAccess } from "@/lib/auth/session";
import {
  adminOrderAccessPermissions,
  adminOrderCapabilitiesForPermissions,
} from "@/lib/orders/admin-access";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import type {
  CancellationRequest,
  AdminOrderListData,
  OrderDetail,
  OrderItem,
  OrderListRow,
  PaymentSchedule,
  PaymentTransfer,
  ProductionUpdate,
  QcInspection,
  DispatchGate,
  LogisticsDetail,
  StatusEvent,
  SupplierOrder,
  SupplierPayment,
  SupplierPaymentSchedule,
} from "@/lib/orders/types";

type DbError = { message: string } | null;
type DbResult<T> = { data: T | null; error: DbError };

function take<T>(result: DbResult<T>, label: string): T | null {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

const orderColumns = "id,organization_id,member_profile_id,project_id,order_number,status,currency,subtotal,vat_rate_snapshot,vat_amount,grand_total,deposit_amount,balance_amount,deposit_verified_at,balance_verified_at,shipping_address_snapshot,cancelled_at,cancellation_reason,created_at,updated_at";
const itemColumns = "id,order_id,item_type,item_name_snapshot,specification_snapshot,options_snapshot,quantity,unit,unit_price_snapshot,line_subtotal,vat_rate_snapshot,vat_amount,line_total,qc_status,custom_member_approved_at";
const scheduleColumns = "id,order_id,schedule_type,due_amount,verified_amount,status,due_at,verified_at,created_at,updated_at";
const transferColumns = "id,payment_schedule_id,transfer_number,amount,transferred_at,evidence_file_id,status,finance_verified_at,finance_note,created_at";
const cancellationColumns = "id,order_id,status,reason,deposit_verified_amount_snapshot,approved_refund_amount,approved_deduction_amount,requested_at,decided_at,decision_note";
const eventColumns = "id,entity_id,from_status,to_status,reason,created_at";

export async function requireOrderMember() {
  const context = await requireAppAccess({ active: true });
  if (!context.roles.includes("MEMBER") || !context.memberProfileId) {
    throw new AppAccessError("PERMISSION_DENIED", 403, "หน้านี้สำหรับสมาชิก");
  }
  return context;
}

export async function requireOrderAdmin() {
  const context = await requireAppAccess({ active: true });
  if (!context.permissions.some((permission) => adminOrderAccessPermissions.includes(permission as typeof adminOrderAccessPermissions[number]))) {
    throw new AppAccessError("PERMISSION_DENIED", 403, "ไม่มีสิทธิ์จัดการ Order และ Payment");
  }
  const capabilities = adminOrderCapabilitiesForPermissions(context.permissions);
  return { context, capabilities };
}

async function attachOrderReferences(
  rows: Array<Record<string, unknown>>,
  mode: "member" | "admin",
): Promise<OrderListRow[]> {
  const database = mode === "admin" ? createInsForgeAdminClient().database : (await createInsForgeServerClient()).database;
  const projectIds = [...new Set(rows.map((row) => String(row.project_id)))];
  const memberIds = mode === "admin" ? [...new Set(rows.map((row) => String(row.member_profile_id)))] : [];
  const projectsResult = projectIds.length
    ? await database.from("projects").select("id,project_number,name,site_address").in("id", projectIds).limit(200)
    : { data: [], error: null };
  const membersResult = memberIds.length
    ? await database.from("member_profiles").select("id,company_name,contact_name").in("id", memberIds).limit(200)
    : { data: [], error: null };
  const projects = take(projectsResult, "load order projects") ?? [];
  const members = take(membersResult, "load order members") ?? [];
  const projectMap = new Map(projects.map((row) => [row.id, row]));
  const memberMap = new Map(members.map((row) => [row.id, row]));
  return rows.map((row) => ({
    ...row,
    project: projectMap.get(String(row.project_id)) ?? null,
    ...(mode === "admin" ? { member: memberMap.get(String(row.member_profile_id)) ?? null } : {}),
  })) as unknown as OrderListRow[];
}

export async function loadMemberOrders(): Promise<OrderListRow[]> {
  const context = await requireOrderMember();
  const db = await createInsForgeServerClient();
  const result = await db.database.from("customer_orders").select(orderColumns)
    .eq("member_profile_id", context.memberProfileId).order("created_at", { ascending: false }).limit(100);
  const rows = take(result, "load member orders") ?? [];
  return attachOrderReferences(rows as unknown as Array<Record<string, unknown>>, "member");
}

export async function loadAdminOrders(): Promise<AdminOrderListData> {
  const { capabilities } = await requireOrderAdmin();
  const admin = createInsForgeAdminClient();
  const result = await admin.database.from("customer_orders").select(orderColumns)
    .order("created_at", { ascending: false }).limit(200);
  const rows = take(result, "load admin orders") ?? [];
  const orders = await attachOrderReferences(rows as unknown as Array<Record<string, unknown>>, "admin");
  return {
    capabilities,
    orders: capabilities.viewSalesAmounts ? orders : orders.map((order) => ({
      ...order,
      subtotal: 0,
      vat_amount: 0,
      grand_total: 0,
      deposit_amount: 0,
      balance_amount: 0,
    })),
  };
}

async function loadOrderDetailBase(id: string, mode: "member" | "admin"): Promise<OrderDetail> {
  const adminAccess = mode === "admin" ? await requireOrderAdmin() : null;
  const context = mode === "member" ? await requireOrderMember() : adminAccess!.context;
  const capabilities = adminAccess?.capabilities;
  const database = mode === "admin" ? createInsForgeAdminClient().database : (await createInsForgeServerClient()).database;
  let orderQuery = database.from("customer_orders").select(orderColumns).eq("id", id);
  if (mode === "member") orderQuery = orderQuery.eq("member_profile_id", context.memberProfileId ?? "");
  const order = take(await orderQuery.maybeSingle(), "load order");
  if (!order) throw new AppAccessError("PERMISSION_DENIED", 404, "ไม่พบ Order");
  const orderRow = order as unknown as Record<string, unknown>;
  const [itemsResult, schedulesResult, cancellationsResult, eventsResult, projectResult, memberResult] = await Promise.all([
    database.from("order_items").select(itemColumns).eq("order_id", id).order("created_at").limit(200),
    mode === "member" || capabilities?.viewCustomerPaymentStatus
      ? database.from("payment_schedules").select(scheduleColumns).eq("order_id", id).order("created_at").limit(20)
      : Promise.resolve({ data: [], error: null }),
    mode === "member" || capabilities?.manageOrder
      ? database.from("cancellation_requests").select(cancellationColumns).eq("order_id", id).order("requested_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [], error: null }),
    database.from("status_events").select(eventColumns).eq("entity_type", "customer_order").eq("entity_id", id).eq("is_member_visible", true).order("created_at").limit(200),
    database.from("projects").select("id,project_number,name,site_address").eq("id", String(orderRow.project_id)).maybeSingle(),
    mode === "admin" ? database.from("member_profiles").select("id,company_name,contact_name").eq("id", String(orderRow.member_profile_id)).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  const schedules = (take(schedulesResult, "load payment schedules") ?? []) as unknown as PaymentSchedule[];
  const scheduleIds = schedules.map((schedule) => schedule.id);
  const transfersResult = scheduleIds.length && (mode === "member" || capabilities?.manageCustomerPayments)
    ? await database.from("payment_transfers").select(transferColumns).in("payment_schedule_id", scheduleIds).order("created_at").limit(200)
    : { data: [], error: null };
  const transfers = (take(transfersResult, "load payment transfers") ?? []) as unknown as PaymentTransfer[];
  const schedulesWithTransfers = schedules.map((schedule) => ({
    ...schedule,
    transfers: transfers.filter((transfer) => transfer.payment_schedule_id === schedule.id),
  }));
  const orderWithRefs = {
    ...orderRow,
    project: take(projectResult, "load order project"),
    ...(mode === "admin" ? { member: take(memberResult, "load order member") } : {}),
  } as unknown as OrderDetail["order"];
  const detail: OrderDetail = {
    order: orderWithRefs,
    items: (take(itemsResult, "load order items") ?? []) as unknown as OrderItem[],
    schedules: schedulesWithTransfers,
    cancellations: (take(cancellationsResult, "load cancellation requests") ?? []) as unknown as CancellationRequest[],
    events: (take(eventsResult, "load order events") ?? []) as unknown as StatusEvent[],
    productionUpdates: [],
    qcInspections: [],
    dispatchGates: [],
    logistics: { receipts: [], consolidations: [], shipments: [], costs: [], invoice: null },
    ...(capabilities ? { capabilities } : {}),
  };

  if (mode === "admin" && !capabilities?.viewSalesAmounts) {
    detail.order = {
      ...detail.order,
      subtotal: 0,
      vat_amount: 0,
      grand_total: 0,
      deposit_amount: 0,
      balance_amount: 0,
    };
    detail.items = detail.items.map((item) => ({
      ...item,
      unit_price_snapshot: 0,
      line_subtotal: 0,
      vat_amount: 0,
      line_total: 0,
    }));
  }

  const adminForOperations = createInsForgeAdminClient();
  const authenticatedOperations = await createInsForgeServerClient();
  const itemIds = detail.items.map((item) => item.id);
  const needsSupplierOperations = mode === "member" || Boolean(
    capabilities?.requestSupplierPayment || capabilities?.manageSupplierPayments
      || capabilities?.manageProduction || capabilities?.manageQc,
  );
  const supplierLinksResult = itemIds.length && needsSupplierOperations
    ? await adminForOperations.database.from("supplier_order_items")
      .select("supplier_order_id,order_item_id").in("order_item_id", itemIds).limit(200)
    : { data: [], error: null };
  const supplierLinks = take(supplierLinksResult, "load operation item links") ?? [];
  const operationSupplierOrderIds = [...new Set(supplierLinks.map((row) => row.supplier_order_id))];
  const [productionResult, qcResult, gateResults] = await Promise.all([
    operationSupplierOrderIds.length && (mode === "member" || Boolean(capabilities?.manageProduction || capabilities?.manageQc)) ? adminForOperations.database.from("production_updates")
      .select("id,supplier_order_id,status,note,estimated_completion_at,progress_percent,started_at,actual_completed_at,delay_reason,created_at")
      .in("supplier_order_id", operationSupplierOrderIds).order("created_at").limit(500) : Promise.resolve({ data: [], error: null }),
    itemIds.length && (mode === "member" || Boolean(capabilities?.manageQc)) ? adminForOperations.database.from("qc_inspections")
      .select("id,order_item_id,result,checklist_version,inspection_type,parent_inspection_id,note,defect_note,rework_note,inspected_at")
      .in("order_item_id", itemIds).order("inspected_at").limit(500) : Promise.resolve({ data: [], error: null }),
    mode === "member" || capabilities?.manageQc || capabilities?.manageLogistics
      ? Promise.all(itemIds.map((itemId) => authenticatedOperations.database.rpc("get_dispatch_gate", { order_item_id_input: itemId })))
      : Promise.resolve([]),
  ]);
  const productionRows = take(productionResult, "load production timeline") ?? [];
  const qcRows = take(qcResult, "load QC inspections") ?? [];
  const productionIds = productionRows.map((row) => row.id);
  const inspectionIds = qcRows.map((row) => row.id);
  const [productionFileLinksResult, qcChecklistResult, qcFileLinksResult, decisionsResult] = await Promise.all([
    productionIds.length ? adminForOperations.database.from("production_update_files").select("production_update_id,file_id").in("production_update_id", productionIds).limit(500) : Promise.resolve({ data: [], error: null }),
    inspectionIds.length ? adminForOperations.database.from("qc_checklist_items").select("id,inspection_id,item_code,label,result,note,display_order").in("inspection_id", inspectionIds).order("display_order").limit(1000) : Promise.resolve({ data: [], error: null }),
    inspectionIds.length ? adminForOperations.database.from("qc_inspection_files").select("inspection_id,file_id").in("inspection_id", inspectionIds).limit(500) : Promise.resolve({ data: [], error: null }),
    inspectionIds.length ? adminForOperations.database.from("qc_member_decisions").select("id,inspection_id,decision,note,decided_at").in("inspection_id", inspectionIds).order("decided_at").limit(500) : Promise.resolve({ data: [], error: null }),
  ]);
  const productionFileLinks = take(productionFileLinksResult, "load production media links") ?? [];
  const qcFileLinks = take(qcFileLinksResult, "load QC evidence links") ?? [];
  const allFileIds = [...new Set([...productionFileLinks, ...qcFileLinks].map((row) => row.file_id))];
  const filesResult = allFileIds.length ? await adminForOperations.database.from("file_metadata")
    .select("id,original_name,mime_type").in("id", allFileIds).limit(1000) : { data: [], error: null };
  const files = take(filesResult, "load operation files") ?? [];
  const fileMap = new Map(files.map((file) => [file.id, file]));
  const checklist = take(qcChecklistResult, "load QC checklist") ?? [];
  const decisions = take(decisionsResult, "load QC member decisions") ?? [];
  detail.productionUpdates = productionRows.map((row) => ({
    id: row.id, status: row.status, note: row.note,
    estimated_completion_at: row.estimated_completion_at,
    progress_percent: row.progress_percent, started_at: row.started_at,
    actual_completed_at: row.actual_completed_at, delay_reason: row.delay_reason,
    created_at: row.created_at,
    ...(mode === "admin" ? { supplier_order_id: row.supplier_order_id } : {}),
    files: productionFileLinks.filter((link) => link.production_update_id === row.id).map((link) => fileMap.get(link.file_id)).filter(Boolean),
  })) as unknown as ProductionUpdate[];
  detail.qcInspections = qcRows.map((row) => ({
    ...row,
    checklist: checklist.filter((item) => item.inspection_id === row.id),
    files: qcFileLinks.filter((link) => link.inspection_id === row.id).map((link) => fileMap.get(link.file_id)).filter(Boolean),
    decisions: decisions.filter((decision) => decision.inspection_id === row.id),
  })) as unknown as QcInspection[];
  detail.dispatchGates = gateResults.flatMap((result) => {
    if (result.error) throw new Error(`load dispatch gate: ${result.error.message}`);
    return result.data ? [result.data as unknown as DispatchGate] : [];
  });

  const logisticsDatabase = mode === "admin" ? createInsForgeAdminClient().database : (await createInsForgeServerClient()).database;
  const canLoadLogistics = mode === "member" || Boolean(capabilities?.manageLogistics || capabilities?.manageFreight);
  const [receiptsResult, consolidationsResult, shipmentsResult, invoiceResult] = await Promise.all([
    mode === "admin" && capabilities?.manageLogistics ? logisticsDatabase.from("warehouse_receipts")
      .select("id,warehouse_id,supplier_order_id,receipt_number,status,received_at,package_count,actual_weight_kg,actual_cbm,note")
      .eq("customer_order_id", id).order("received_at").limit(100) : Promise.resolve({ data: [], error: null }),
    mode === "admin" && capabilities?.manageLogistics ? logisticsDatabase.from("consolidation_groups")
      .select("id,consolidation_number,warehouse_id,strategy,status,reason")
      .eq("customer_order_id", id).order("created_at").limit(100) : Promise.resolve({ data: [], error: null }),
    canLoadLogistics ? logisticsDatabase.from("shipments")
      .select("id,shipment_number,shipment_name,shipment_type,shipping_method,status,tracking_number,estimated_arrival_at,dispatched_at")
      .eq("customer_order_id", id).order("created_at").limit(100) : Promise.resolve({ data: [], error: null }),
    (mode === "member" || capabilities?.manageFreight) ? logisticsDatabase.from("freight_invoices")
      .select("id,payment_schedule_id,invoice_number,currency,subtotal,vat_rate_snapshot,vat_amount,grand_total,status,due_at,issued_at")
      .eq("customer_order_id", id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  const receipts = take(receiptsResult, "load warehouse receipts") ?? [];
  const consolidations = take(consolidationsResult, "load consolidations") ?? [];
  const shipments = take(shipmentsResult, "load shipments") ?? [];
  const receiptIds = receipts.map((row) => row.id);
  const consolidationIds = consolidations.map((row) => row.id);
  const shipmentIds = shipments.map((row) => row.id);
  const invoice = take(invoiceResult, "load freight invoice");
  const [receiptItemsResult, consolidationItemsResult, shipmentItemsResult, historyResult,
    partialDecisionsResult, deliveriesResult, costsResult, invoiceItemsResult] = await Promise.all([
    receiptIds.length ? logisticsDatabase.from("warehouse_receipt_items")
      .select("id,warehouse_receipt_id,supplier_order_item_id,order_item_id,expected_quantity,received_quantity,released_quantity,blocked_quantity,condition")
      .in("warehouse_receipt_id", receiptIds).limit(500) : Promise.resolve({ data: [], error: null }),
    consolidationIds.length ? logisticsDatabase.from("consolidation_items")
      .select("id,consolidation_group_id,warehouse_receipt_item_id,order_item_id,quantity")
      .in("consolidation_group_id", consolidationIds).limit(500) : Promise.resolve({ data: [], error: null }),
    shipmentIds.length ? logisticsDatabase.from("shipment_items")
      .select("id,shipment_id,order_item_id,warehouse_receipt_item_id,quantity")
      .in("shipment_id", shipmentIds).limit(500) : Promise.resolve({ data: [], error: null }),
    shipmentIds.length ? logisticsDatabase.from("shipment_status_history")
      .select("id,shipment_id,status,location_text,event_at,note,is_delay,eta_at")
      .in("shipment_id", shipmentIds).order("event_at").limit(500) : Promise.resolve({ data: [], error: null }),
    shipmentIds.length ? logisticsDatabase.from("partial_shipment_decisions")
      .select("id,shipment_id,reason,remaining_plan,additional_member_charge,charge_bearer,member_acknowledgement_required,member_acknowledged_at")
      .in("shipment_id", shipmentIds).limit(100) : Promise.resolve({ data: [], error: null }),
    shipmentIds.length ? logisticsDatabase.from("deliveries")
      .select("id,shipment_id,delivery_number,status,scheduled_at,scheduled_window_end_at,delivered_at,contact_name,contact_phone,recipient_name,recipient_phone,site_note,failure_reason,next_delivery_plan")
      .in("shipment_id", shipmentIds).order("created_at").limit(200) : Promise.resolve({ data: [], error: null }),
    mode === "admin" && capabilities?.manageFreight ? logisticsDatabase.from("logistics_cost_items")
      .select("id,shipment_id,delivery_id,category,description,supplier_cost,supplier_currency,exchange_rate,member_charge,member_currency,is_billable,status,internal_note,member_visible_note")
      .eq("customer_order_id", id).order("created_at").limit(300) : Promise.resolve({ data: [], error: null }),
    invoice ? logisticsDatabase.from("freight_invoice_items")
      .select("id,freight_invoice_id,category_snapshot,description_snapshot,amount_snapshot")
      .eq("freight_invoice_id", invoice.id).limit(100) : Promise.resolve({ data: [], error: null }),
  ]);
  const deliveries = take(deliveriesResult, "load deliveries") ?? [];
  const deliveryIds = deliveries.map((row) => row.id);
  const [deliveryItemsResult, evidenceResult, reschedulesResult] = await Promise.all([
    deliveryIds.length ? logisticsDatabase.from("delivery_items")
      .select("id,delivery_id,shipment_item_id,order_item_id,expected_quantity,quantity_delivered,remaining_quantity,condition,issue_type,issue_description")
      .in("delivery_id", deliveryIds).limit(500) : Promise.resolve({ data: [], error: null }),
    deliveryIds.length ? logisticsDatabase.from("delivery_evidence")
      .select("id,delivery_id,file_id,evidence_type").in("delivery_id", deliveryIds).limit(500) : Promise.resolve({ data: [], error: null }),
    deliveryIds.length ? logisticsDatabase.from("delivery_reschedule_requests")
      .select("id,delivery_id,status,preferred_dates,reason,decision_note,accepted_scheduled_at")
      .in("delivery_id", deliveryIds).order("requested_at").limit(200) : Promise.resolve({ data: [], error: null }),
  ]);
  const receiptItems = take(receiptItemsResult, "load receipt items") ?? [];
  const consolidationItems = take(consolidationItemsResult, "load consolidation items") ?? [];
  const shipmentItems = take(shipmentItemsResult, "load shipment items") ?? [];
  const history = take(historyResult, "load shipment history") ?? [];
  const partialDecisions = take(partialDecisionsResult, "load partial decisions") ?? [];
  const deliveryItems = take(deliveryItemsResult, "load delivery items") ?? [];
  const evidence = take(evidenceResult, "load delivery evidence") ?? [];
  const reschedules = take(reschedulesResult, "load delivery reschedules") ?? [];
  detail.logistics = {
    receipts: receipts.map((row) => ({ ...row, items: receiptItems.filter((item) => item.warehouse_receipt_id === row.id) })),
    consolidations: consolidations.map((row) => ({ ...row, items: consolidationItems.filter((item) => item.consolidation_group_id === row.id) })),
    shipments: shipments.map((row) => ({ ...row,
      items: shipmentItems.filter((item) => item.shipment_id === row.id),
      history: history.filter((event) => event.shipment_id === row.id),
      partialDecision: partialDecisions.find((decision) => decision.shipment_id === row.id) ?? null,
      deliveries: deliveries.filter((delivery) => delivery.shipment_id === row.id).map((delivery) => ({ ...delivery,
        items: deliveryItems.filter((item) => item.delivery_id === delivery.id),
        evidence: evidence.filter((item) => item.delivery_id === delivery.id),
        reschedules: reschedules.filter((item) => item.delivery_id === delivery.id),
      })),
    })),
    costs: (take(costsResult, "load logistics costs") ?? []) as unknown as LogisticsDetail["costs"],
    invoice: invoice ? { ...invoice, items: take(invoiceItemsResult, "load invoice items") ?? [] } as unknown as LogisticsDetail["invoice"] : null,
  } as unknown as LogisticsDetail;

  if (mode === "admin" && needsSupplierOperations) {
    const admin = createInsForgeAdminClient();
    const supplierOrdersResult = await admin.database.from("supplier_orders")
      .select("id,customer_order_id,supplier_id,supplier_order_number,po_number,status,supplier_currency,total_factory_cost,paid_factory_amount,po_issued_at")
      .eq("customer_order_id", id).order("created_at").limit(50);
    const supplierOrders = take(supplierOrdersResult, "load supplier orders") ?? [];
    const supplierOrderIds = supplierOrders.map((row) => row.id);
    const supplierIds = [...new Set(supplierOrders.map((row) => row.supplier_id))];
    const [suppliersResult, supplierSchedulesResult, supplierPaymentsResult] = await Promise.all([
      supplierIds.length ? admin.database.from("suppliers").select("id,code,name").in("id", supplierIds).limit(50) : Promise.resolve({ data: [], error: null }),
      supplierOrderIds.length ? admin.database.from("supplier_payment_schedules").select("id,supplier_order_id,schedule_type,due_amount,paid_amount,status").in("supplier_order_id", supplierOrderIds).limit(100) : Promise.resolve({ data: [], error: null }),
      supplierOrderIds.length ? admin.database.from("supplier_payments").select("id,supplier_order_id,payment_schedule_id,payment_reference,payment_type,amount,currency,status,rejection_reason,note,paid_at,created_at").in("supplier_order_id", supplierOrderIds).order("created_at").limit(200) : Promise.resolve({ data: [], error: null }),
    ]);
    const suppliers = take(suppliersResult, "load suppliers") ?? [];
    const supplierSchedules = (take(supplierSchedulesResult, "load supplier schedules") ?? []) as unknown as SupplierPaymentSchedule[];
    const supplierPayments = (take(supplierPaymentsResult, "load supplier payments") ?? []) as unknown as SupplierPayment[];
    const supplierMap = new Map(suppliers.map((row) => [row.id, row]));
    detail.supplierOrders = supplierOrders.map((row) => ({
      ...row,
      supplier: supplierMap.get(row.supplier_id) ?? null,
      schedules: supplierSchedules.filter((schedule) => schedule.supplier_order_id === row.id),
      payments: supplierPayments.filter((payment) => payment.supplier_order_id === row.id),
      orderItemIds: supplierLinks.filter((link) => link.supplier_order_id === row.id).map((link) => link.order_item_id),
      productionUpdates: detail.productionUpdates.filter((update) => update.supplier_order_id === row.id),
    })) as unknown as SupplierOrder[];
  }
  return detail;
}

export function loadMemberOrderDetail(id: string) {
  return loadOrderDetailBase(id, "member");
}

export function loadAdminOrderDetail(id: string) {
  return loadOrderDetailBase(id, "admin");
}

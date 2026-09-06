export type OrderStatus =
  | "PENDING_DEPOSIT"
  | "DEPOSIT_VERIFIED"
  | "CANCELLATION_REQUESTED"
  | "PO_ISSUED"
  | "IN_PRODUCTION"
  | "READY_TO_SHIP"
  | "PARTIALLY_SHIPPED"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentScheduleStatus =
  | "PENDING"
  | "PARTIALLY_VERIFIED"
  | "VERIFIED"
  | "OVERPAYMENT_REVIEW"
  | "CANCELLED";

export const orderStatusLabels: Record<string, string> = {
  DRAFT: "ร่าง",
  PENDING_DEPOSIT: "รอตรวจมัดจำ",
  DEPOSIT_VERIFIED: "ตรวจมัดจำครบแล้ว",
  CANCELLATION_REQUESTED: "รอพิจารณายกเลิก",
  PO_ISSUED: "ออก PO แล้ว",
  IN_PRODUCTION: "กำลังผลิต",
  READY_TO_SHIP: "พร้อมจัดส่ง",
  PARTIALLY_SHIPPED: "จัดส่งบางส่วน",
  SHIPPED: "จัดส่งแล้ว",
  DELIVERED: "ส่งมอบแล้ว",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};

export const paymentScheduleLabels: Record<string, string> = {
  DEPOSIT: "มัดจำ 50%",
  BALANCE: "ยอดคงเหลือ 50%",
  FREIGHT: "ค่าขนส่ง",
};

export const paymentStatusLabels: Record<string, string> = {
  PENDING: "รอหลักฐาน",
  PARTIALLY_VERIFIED: "ตรวจแล้วบางส่วน",
  VERIFIED: "ตรวจครบแล้ว",
  OVERPAYMENT_REVIEW: "ยอดเกิน—รอตรวจ",
  CANCELLED: "ยกเลิก",
  SUBMITTED: "รอตรวจ",
  REJECTED: "ไม่ผ่าน",
};

export function orderStatusTone(status: string) {
  if (["DEPOSIT_VERIFIED", "PO_ISSUED", "COMPLETED", "DELIVERED"].includes(status)) return "good";
  if (["CANCELLED", "OVERPAYMENT_REVIEW", "REJECTED"].includes(status)) return "bad";
  return "pending";
}

export function formatOrderMoney(value: number | string, currency = "THB") {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value));
}

export type OrderListRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  currency: string;
  subtotal: number;
  vat_amount: number;
  grand_total: number;
  deposit_amount: number;
  balance_amount: number;
  deposit_verified_at: string | null;
  balance_verified_at: string | null;
  created_at: string;
  project: { id: string; project_number: string; name: string; site_address: string } | null;
  member?: { id: string; company_name: string; contact_name: string } | null;
};

export type AdminOrderCapabilities = {
  manageOrder: boolean;
  viewSalesAmounts: boolean;
  viewCustomerPaymentStatus: boolean;
  manageCustomerPayments: boolean;
  requestSupplierPayment: boolean;
  manageSupplierPayments: boolean;
  manageProduction: boolean;
  manageQc: boolean;
  manageLogistics: boolean;
  manageFreight: boolean;
};

export type AdminOrderListData = {
  orders: OrderListRow[];
  capabilities: AdminOrderCapabilities;
};

export type OrderItem = {
  id: string;
  item_type: "STANDARD" | "CUSTOM";
  item_name_snapshot: string;
  specification_snapshot: string | null;
  options_snapshot: Array<{ label?: string }>;
  quantity: number;
  unit: string;
  unit_price_snapshot: number;
  line_subtotal: number;
  vat_amount: number;
  line_total: number;
  qc_status: string;
  custom_member_approved_at: string | null;
};

export type OperationFile = {
  id: string;
  original_name: string;
  mime_type: string | null;
};

export type ProductionUpdate = {
  id: string;
  supplier_order_id?: string;
  status: string;
  note: string | null;
  estimated_completion_at: string | null;
  progress_percent: number | null;
  started_at: string | null;
  actual_completed_at: string | null;
  delay_reason: string | null;
  created_at: string;
  files: OperationFile[];
};

export type QcChecklistItem = {
  id: string;
  item_code: string;
  label: string;
  result: "PASSED" | "FAILED" | "NOT_INSPECTED";
  note: string | null;
  display_order: number;
};

export type QcMemberDecision = {
  id: string;
  decision: "APPROVED" | "ADDITIONAL_REVIEW_REQUESTED";
  note: string | null;
  decided_at: string;
};

export type QcInspection = {
  id: string;
  order_item_id: string;
  result: "PASSED" | "FAILED" | "REWORK_REQUIRED";
  checklist_version: string;
  inspection_type: "INITIAL" | "REINSPECTION";
  parent_inspection_id: string | null;
  note: string | null;
  defect_note: string | null;
  rework_note: string | null;
  inspected_at: string;
  checklist: QcChecklistItem[];
  files: OperationFile[];
  decisions: QcMemberDecision[];
};

export type DispatchGate = {
  order_item_id: string;
  qc_passed: boolean;
  member_approval_required: boolean;
  member_approved: boolean;
  customer_balance_verified: boolean;
  supplier_balance_paid: boolean;
  can_dispatch: boolean;
};

export type PaymentTransfer = {
  id: string;
  payment_schedule_id: string;
  transfer_number: string;
  amount: number;
  transferred_at: string;
  status: "SUBMITTED" | "VERIFIED" | "REJECTED";
  finance_note: string | null;
  finance_verified_at: string | null;
  evidence_file_id: string;
  created_at: string;
};

export type PaymentSchedule = {
  id: string;
  schedule_type: "DEPOSIT" | "BALANCE" | "FREIGHT";
  due_amount: number;
  verified_amount: number;
  status: PaymentScheduleStatus;
  verified_at: string | null;
  transfers: PaymentTransfer[];
};

export type CancellationRequest = {
  id: string;
  status: "SUBMITTED" | "APPROVED" | "REJECTED";
  reason: string;
  deposit_verified_amount_snapshot: number;
  approved_refund_amount: number;
  approved_deduction_amount: number;
  requested_at: string;
  decided_at: string | null;
  decision_note: string | null;
};

export type StatusEvent = {
  id: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  created_at: string;
};

export type SupplierPaymentSchedule = {
  id: string;
  supplier_order_id: string;
  schedule_type: "DEPOSIT" | "BALANCE";
  due_amount: number;
  paid_amount: number;
  status: string;
};

export type SupplierPayment = {
  id: string;
  supplier_order_id: string;
  payment_schedule_id: string;
  payment_reference: string;
  payment_type: "DEPOSIT" | "BALANCE";
  amount: number;
  currency: string;
  status: "REQUESTED" | "APPROVED" | "PAID" | "REJECTED";
  rejection_reason: string | null;
  note: string | null;
  paid_at: string | null;
  created_at: string;
};

export type SupplierOrder = {
  id: string;
  supplier_order_number: string;
  po_number: string | null;
  status: string;
  supplier_currency: string;
  total_factory_cost: number;
  paid_factory_amount: number;
  supplier: { id: string; code: string; name: string } | null;
  schedules: SupplierPaymentSchedule[];
  payments: SupplierPayment[];
  orderItemIds: string[];
  productionUpdates: ProductionUpdate[];
};

export type WarehouseReceiptItem = {
  id: string;
  supplier_order_item_id: string;
  order_item_id: string;
  expected_quantity: number;
  received_quantity: number;
  released_quantity: number;
  blocked_quantity: number;
  condition: string;
};

export type WarehouseReceipt = {
  id: string;
  warehouse_id: string;
  supplier_order_id: string;
  receipt_number: string;
  status: string;
  received_at: string;
  package_count: number;
  actual_weight_kg: number | null;
  actual_cbm: number | null;
  note: string | null;
  items: WarehouseReceiptItem[];
};

export type ConsolidationGroup = {
  id: string;
  consolidation_number: string;
  warehouse_id: string;
  strategy: "CONSOLIDATE_ALL" | "PARTIAL" | "DIRECT";
  status: string;
  reason: string | null;
  items: Array<{ id: string; warehouse_receipt_item_id: string; order_item_id: string; quantity: number }>;
};

export type ShipmentHistory = {
  id: string;
  status: string;
  location_text: string | null;
  event_at: string;
  note: string | null;
  is_delay: boolean;
  eta_at: string | null;
};

export type DeliveryItem = {
  id: string;
  shipment_item_id: string;
  order_item_id: string;
  expected_quantity: number;
  quantity_delivered: number;
  remaining_quantity: number;
  condition: string;
  issue_type: string | null;
  issue_description: string | null;
};

export type Delivery = {
  id: string;
  delivery_number: string;
  status: string;
  scheduled_at: string | null;
  scheduled_window_end_at: string | null;
  delivered_at: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  site_note: string | null;
  failure_reason: string | null;
  next_delivery_plan: string | null;
  items: DeliveryItem[];
  evidence: Array<{ id: string; file_id: string; evidence_type: string }>;
  reschedules: Array<{
    id: string; status: string; preferred_dates: unknown[]; reason: string;
    decision_note: string | null; accepted_scheduled_at: string | null;
  }>;
};

export type Shipment = {
  id: string;
  shipment_number: string;
  shipment_name: string;
  shipment_type: "CONSOLIDATED" | "PARTIAL" | "DIRECT";
  shipping_method: string | null;
  status: string;
  tracking_number: string | null;
  estimated_arrival_at: string | null;
  dispatched_at: string | null;
  items: Array<{ id: string; order_item_id: string; warehouse_receipt_item_id: string; quantity: number }>;
  history: ShipmentHistory[];
  deliveries: Delivery[];
  partialDecision: {
    id: string; reason: string; remaining_plan: string; additional_member_charge: number;
    charge_bearer: string; member_acknowledgement_required: boolean; member_acknowledged_at: string | null;
  } | null;
};

export type LogisticsCost = {
  id: string; shipment_id: string | null; delivery_id: string | null; category: string;
  description: string; supplier_cost: number; supplier_currency: string; exchange_rate: number;
  member_charge: number; member_currency: string; is_billable: boolean; status: string;
  internal_note: string | null; member_visible_note: string | null;
};

export type FreightInvoice = {
  id: string; payment_schedule_id: string; invoice_number: string; currency: string;
  subtotal: number; vat_rate_snapshot: number; vat_amount: number; grand_total: number;
  status: string; due_at: string | null; issued_at: string;
  items: Array<{ id: string; category_snapshot: string; description_snapshot: string; amount_snapshot: number }>;
};

export type LogisticsDetail = {
  receipts: WarehouseReceipt[];
  consolidations: ConsolidationGroup[];
  shipments: Shipment[];
  costs: LogisticsCost[];
  invoice: FreightInvoice | null;
};

export type OrderDetail = {
  order: OrderListRow & { shipping_address_snapshot: { site_address?: string } };
  items: OrderItem[];
  schedules: PaymentSchedule[];
  cancellations: CancellationRequest[];
  events: StatusEvent[];
  supplierOrders?: SupplierOrder[];
  productionUpdates: ProductionUpdate[];
  qcInspections: QcInspection[];
  dispatchGates: DispatchGate[];
  logistics: LogisticsDetail;
  capabilities?: AdminOrderCapabilities;
};

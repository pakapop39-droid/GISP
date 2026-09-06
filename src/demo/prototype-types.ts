import type { DemoProduct, DemoProject, DemoProjectItem, DemoRole, DemoSupplier } from "./types";

export const PROTOTYPE_SCHEMA_VERSION = 3 as const;
export const PROTOTYPE_STORAGE_KEY = "gisp-demo-prototype-v3";

export type PrototypeModule =
  | "FOUNDATION"
  | "ACTION_CENTER"
  | "PRODUCT_ADMIN"
  | "DASHBOARDS"
  | "CATALOG"
  | "RFQ"
  | "ORDER"
  | "QC"
  | "SHIPMENT"
  | "DOCUMENTS"
  | "UAT";

export type DemoFileMeta = { name: string; type: string; size: number };

export type MemberApplicationStatus = "NOT_STARTED" | "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export type PrototypeMemberApplication = {
  id: string;
  email: string;
  registered: boolean;
  companyName: string;
  taxId: string;
  status: MemberApplicationStatus;
  reviewNote: string | null;
};

export type PrototypeOrganizationUser = {
  id: string;
  email: string;
  fullName: string;
  organizationId: string;
  roles: DemoRole[];
  status: "ACTIVE" | "INVITED";
};

export type PrototypePermissionCase = {
  id: string;
  label: string;
  result: "NOT_TESTED" | "ALLOWED" | "DENIED";
  detail: string;
};

export type PrototypeProduct = DemoProduct & {
  lifecycleStatus: "DRAFT" | "PUBLISHED" | "DISCONTINUED";
  activeMemberPrice: boolean;
  variants: string[];
  options: string[];
  media: DemoFileMeta[];
  confidentialFiles: DemoFileMeta[];
  internalNote: string;
};

export type PrototypeSupplier = DemoSupplier & {
  status: "ACTIVE" | "INACTIVE";
  contactName: string;
  documents: DemoFileMeta[];
};

export type PrototypeActionItem = {
  id: string;
  role: DemoRole;
  title: string;
  detail: string;
  sourceModule: PrototypeModule;
  sourceId: string;
  dueDate: string;
  status: "OPEN" | "DONE";
};

export type PrototypeUatResult = {
  id: string;
  title: string;
  status: "NOT_TESTED" | "PASS" | "NEEDS_FIX";
  note: string;
};

export type PrototypeRfq = {
  id: string;
  number: string;
  itemIds: string[];
  title: string;
  specification: string;
  files: DemoFileMeta[];
  supplierId: string | null;
  status: "SUBMITTED" | "NEEDS_INFO" | "READY_TO_QUOTE" | "QUOTED";
  adminMessage: string | null;
};

export type PrototypeQuotation = {
  id: string;
  number: string;
  rfqId: string;
  version: number;
  status: "SENT" | "SUPERSEDED" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  unitPrices: Record<string, string>;
  subtotal: string;
  vatRate: string;
  vatAmount: string;
  grandTotal: string;
  specificationSnapshot: string;
  leadTimeDays: number;
  validityDays: number;
};

export type PrototypeOrderLine = {
  projectItemId: string;
  quantity: number;
  unitPrice: string;
};

export type PrototypeOrder = {
  id: string;
  number: string;
  lines: PrototypeOrderLine[];
  subtotal: string;
  vatRate: string;
  vatAmount: string;
  grandTotal: string;
  deposit: string;
  balance: string;
  status: "AWAITING_DEPOSIT" | "PO_ISSUED" | "IN_PRODUCTION" | "READY_TO_SHIP";
};

export type PrototypePaymentSchedule = {
  id: string;
  type: "DEPOSIT" | "BALANCE";
  dueAmount: string;
  verifiedAmount: string;
  status: "PENDING" | "VERIFIED";
};

export type PrototypeTransfer = {
  id: string;
  scheduleId: string;
  amount: string;
  reference: string;
  status: "SUBMITTED" | "VERIFIED" | "REJECTED";
  rejectReason: string | null;
};

export type PrototypeSupplierOrder = {
  id: string;
  number: string;
  supplierId: string;
  itemIds: string[];
  factoryCostTotal: string;
  supplierBalancePaid: boolean;
};

export type PrototypeProductionUpdate = {
  id: string;
  progress: number;
  eta: string;
  note: string;
  delayed: boolean;
};

export type PrototypeQcInspection = {
  id: string;
  projectItemId: string;
  result: "FAILED" | "REWORK_REQUIRED" | "PASSED";
  note: string;
  correctionOfId: string | null;
};

export type PrototypeShipment = {
  id: string;
  number: string;
  allocations: Array<{ projectItemId: string; quantity: number }>;
  tracking: string;
  status: "DRAFT" | "IN_TRANSIT" | "DELIVERED";
  recipient: string | null;
  deliveryResult: "COMPLETE" | "WITH_ISSUE" | null;
  evidence: DemoFileMeta[];
};

export type PrototypeClaim = {
  id: string;
  number: string;
  shipmentId: string;
  projectItemId: string;
  description: string;
  status: "SUBMITTED" | "RESOLVED" | "REJECTED" | "CLOSED";
  resolution: string | null;
};

export type PrototypeAuditEvent = {
  id: string;
  at: string;
  actor: DemoRole;
  action: string;
  detail: string;
};

export type PrototypeState = {
  schemaVersion: typeof PROTOTYPE_SCHEMA_VERSION;
  activeRole: DemoRole;
  activeModule: PrototypeModule;
  memberApplication: PrototypeMemberApplication;
  organizationUsers: PrototypeOrganizationUser[];
  permissionCases: PrototypePermissionCase[];
  catalog: PrototypeProduct[];
  suppliers: PrototypeSupplier[];
  actionItems: PrototypeActionItem[];
  uatResults: PrototypeUatResult[];
  buildReadiness: "IN_UAT" | "APPROVED_FOR_MVP_BUILD";
  project: DemoProject;
  projectItems: DemoProjectItem[];
  rfq: PrototypeRfq | null;
  quotations: PrototypeQuotation[];
  order: PrototypeOrder | null;
  paymentSchedules: PrototypePaymentSchedule[];
  transfers: PrototypeTransfer[];
  supplierOrders: PrototypeSupplierOrder[];
  productionUpdates: PrototypeProductionUpdate[];
  qcInspections: PrototypeQcInspection[];
  memberApprovedItemIds: string[];
  shipments: PrototypeShipment[];
  claim: PrototypeClaim | null;
  audit: PrototypeAuditEvent[];
  lastError: string | null;
};

type ActionMeta = { at: string };

export type PrototypeAction =
  | ({ type: "HYDRATE"; state: PrototypeState } & ActionMeta)
  | ({ type: "RESET_PROTOTYPE" } & ActionMeta)
  | ({ type: "SWITCH_ROLE"; role: DemoRole; module?: PrototypeModule } & ActionMeta)
  | ({ type: "SET_MODULE"; module: PrototypeModule } & ActionMeta)
  | ({ type: "REGISTER_DEMO_ACCOUNT"; email: string } & ActionMeta)
  | ({ type: "SUBMIT_MEMBER_APPLICATION"; companyName: string; taxId: string } & ActionMeta)
  | ({ type: "REVIEW_MEMBER_APPLICATION"; decision: "APPROVE" | "REJECT"; note: string } & ActionMeta)
  | ({ type: "INVITE_ORGANIZATION_USER"; email: string; fullName: string } & ActionMeta)
  | ({ type: "SET_ORGANIZATION_USER_ROLES"; userId: string; roles: DemoRole[] } & ActionMeta)
  | ({ type: "RUN_PERMISSION_CASE"; caseId: string } & ActionMeta)
  | ({ type: "CREATE_SUPPLIER"; name: string; city: string; contactName: string; files: DemoFileMeta[] } & ActionMeta)
  | ({ type: "CREATE_PRODUCT_DRAFT"; nameTh: string; sku: string; supplierId: string; memberUnitPrice: string; factoryUnitCost: string } & ActionMeta)
  | ({ type: "UPDATE_PRODUCT_MASTER"; productId: string; memberUnitPrice?: string; factoryUnitCost?: string; activeMemberPrice?: boolean; variants?: string[]; options?: string[]; media?: DemoFileMeta[]; confidentialFiles?: DemoFileMeta[] } & ActionMeta)
  | ({ type: "PUBLISH_PRODUCT"; productId: string } & ActionMeta)
  | ({ type: "DISCONTINUE_PRODUCT"; productId: string } & ActionMeta)
  | ({ type: "COMPLETE_ACTION_ITEM"; actionItemId: string } & ActionMeta)
  | ({ type: "UPDATE_UAT_RESULT"; resultId: string; status: PrototypeUatResult["status"]; note: string } & ActionMeta)
  | ({ type: "SIGN_OFF_UAT" } & ActionMeta)
  | ({ type: "ADD_PROJECT_ITEM"; productId: string; quantity: number; area: string } & ActionMeta)
  | ({ type: "UPDATE_PROJECT_ITEM"; itemId: string; quantity?: number; area?: string; specification?: string } & ActionMeta)
  | ({ type: "REMOVE_PROJECT_ITEM"; itemId: string } & ActionMeta)
  | ({ type: "SUBMIT_RFQ"; itemIds: string[]; title: string; specification: string; files: DemoFileMeta[] } & ActionMeta)
  | ({ type: "REQUEST_RFQ_INFO"; message: string } & ActionMeta)
  | ({ type: "RESUBMIT_RFQ"; specification: string } & ActionMeta)
  | ({ type: "SEND_QUOTATION"; unitPrices: Record<string, string>; specification: string; leadTimeDays: number; validityDays: number } & ActionMeta)
  | ({ type: "EXPIRE_QUOTATION"; quotationId: string } & ActionMeta)
  | ({ type: "RESPOND_QUOTATION"; quotationId: string; response: "ACCEPT" | "REJECT" } & ActionMeta)
  | ({ type: "CREATE_ORDER"; quantities: Record<string, number> } & ActionMeta)
  | ({ type: "SUBMIT_PAYMENT"; scheduleId: string; amount: string; reference: string } & ActionMeta)
  | ({ type: "VERIFY_PAYMENT"; transferId: string } & ActionMeta)
  | ({ type: "REJECT_PAYMENT"; transferId: string; reason: string } & ActionMeta)
  | ({ type: "ISSUE_PO" } & ActionMeta)
  | ({ type: "RECORD_PRODUCTION_UPDATE"; progress: number; eta: string; note: string; delayed: boolean } & ActionMeta)
  | ({ type: "RECORD_QC"; projectItemId: string; result: PrototypeQcInspection["result"]; note: string } & ActionMeta)
  | ({ type: "CORRECT_QC"; inspectionId: string; note: string } & ActionMeta)
  | ({ type: "APPROVE_CUSTOM_QC"; projectItemId: string } & ActionMeta)
  | ({ type: "MARK_SUPPLIER_BALANCE_PAID"; supplierOrderId: string } & ActionMeta)
  | ({ type: "CREATE_SHIPMENT"; allocations: Array<{ projectItemId: string; quantity: number }>; tracking: string } & ActionMeta)
  | ({ type: "RECORD_DELIVERY"; shipmentId: string; recipient: string; result: "COMPLETE" | "WITH_ISSUE"; evidence: DemoFileMeta[] } & ActionMeta)
  | ({ type: "OPEN_CLAIM"; shipmentId: string; projectItemId: string; description: string } & ActionMeta)
  | ({ type: "RESOLVE_CLAIM"; resolution: string } & ActionMeta)
  | ({ type: "REJECT_CLAIM"; reason: string } & ActionMeta)
  | ({ type: "CONFIRM_CLAIM" } & ActionMeta);

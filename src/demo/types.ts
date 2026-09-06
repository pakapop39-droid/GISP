export const demoRoles = [
  "MEMBER",
  "GISP_ADMIN",
  "FINANCE",
  "QC",
  "LOGISTICS",
  "EXECUTIVE",
] as const;

export type DemoRole = (typeof demoRoles)[number];

export const demoSceneIds = [
  "WELCOME",
  "PROJECT_CATALOG",
  "CUSTOM_RFQ",
  "QUOTATION",
  "ORDER_DEPOSIT",
  "PRODUCTION_QC",
  "APPROVAL_BALANCE",
  "PARTIAL_SHIPMENT",
  "DELIVERY_CLAIM",
  "EXECUTIVE_SUMMARY",
] as const;

export type DemoSceneId = (typeof demoSceneIds)[number];

export type DemoSceneDefinition = {
  id: DemoSceneId;
  order: number;
  title: string;
  actorRole: DemoRole;
  actionLabel: string;
  outcome: string;
};

export type DemoOrganization = {
  id: string;
  code: string;
  name: string;
  kind: "GISP" | "MEMBER" | "END_CUSTOMER";
};

export type DemoUser = {
  id: string;
  organizationId: string;
  fullName: string;
  role: DemoRole;
  title: string;
};

export type DemoSupplier = {
  id: string;
  code: string;
  name: string;
  city: string;
  country: "China";
  internalNote: string;
};

export type DemoProduct = {
  id: string;
  sku: string;
  nameTh: string;
  nameEn: string;
  kind: "STANDARD" | "CUSTOM";
  supplierId: string;
  category: string;
  memberUnitPrice: string;
  factoryUnitCost: string;
  currency: "THB";
  leadTimeDays: number;
  specification: string;
};

export type DemoProject = {
  id: string;
  code: string;
  organizationId: string;
  endCustomerOrganizationId: string;
  name: string;
  projectType: "BOUTIQUE_HOTEL";
  siteAddress: string;
  areas: string[];
  targetDeliveryDate: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED";
};

export type DemoProjectItem = {
  id: string;
  projectId: string;
  productId: string;
  supplierId: string;
  area: string;
  quantity: number;
  kind: "STANDARD" | "CUSTOM";
  memberUnitPriceSnapshot: string | null;
  specificationSnapshot: string;
  status:
    | "READY_TO_ORDER"
    | "WAITING_QUOTATION"
    | "ORDERED"
    | "DELIVERED";
  customQuotationId: string | null;
  memberApprovedAt: string | null;
};

export type DemoCustomRequest = {
  id: string;
  requestNumber: string;
  projectId: string;
  itemIds: string[];
  title: string;
  specification: string;
  status: "SUBMITTED" | "READY_TO_QUOTE" | "QUOTED";
  submittedAt: string;
};

export type DemoQuotation = {
  id: string;
  quotationNumber: string;
  customRequestId: string;
  version: number;
  status: "SUPERSEDED" | "ACCEPTED";
  subtotal: string;
  vatRate: string;
  vatAmount: string;
  grandTotal: string;
  leadTimeDays: number;
  specificationSnapshot: string;
  sentAt: string;
  acceptedAt: string | null;
};

export type DemoOrder = {
  id: string;
  orderNumber: string;
  projectId: string;
  projectItemIds: string[];
  subtotal: string;
  vatRate: string;
  vatAmount: string;
  grandTotal: string;
  status:
    | "PROCESSING"
    | "IN_PRODUCTION"
    | "BALANCE_PAID"
    | "PARTIALLY_SHIPPED"
    | "DELIVERED"
    | "COMPLETED";
  createdAt: string;
};

export type DemoPaymentSchedule = {
  id: string;
  orderId: string;
  type: "DEPOSIT" | "BALANCE" | "FREIGHT";
  dueAmount: string;
  status: "PENDING" | "VERIFIED";
  verifiedAmount: string;
  subtotalBeforeVat?: string;
  vatRate?: string;
  vatAmount?: string;
};

export type DemoPaymentTransfer = {
  id: string;
  scheduleId: string;
  reference: string;
  amount: string;
  submittedAt: string;
  status: "VERIFIED";
};

export type DemoSupplierOrder = {
  id: string;
  supplierOrderNumber: string;
  orderId: string;
  supplierId: string;
  projectItemIds: string[];
  factoryCostTotal: string;
  status:
    | "PO_ISSUED"
    | "QC_PASSED"
    | "WAITING_MEMBER_APPROVAL"
    | "READY_FOR_FACTORY_DISPATCH"
    | "SHIPPED";
  supplierDepositPaid: boolean;
  supplierBalancePaid: boolean;
};

export type DemoProductionEvent = {
  id: string;
  supplierOrderId: string;
  status:
    | "MATERIAL_PREPARATION"
    | "IN_PRODUCTION"
    | "DELAYED"
    | "PRODUCTION_COMPLETED"
    | "REWORK_REQUIRED"
    | "QC_PASSED";
  occurredAt: string;
  note: string;
  progressPercent: number;
};

export type DemoQcInspection = {
  id: string;
  projectItemId: string;
  result: "FAILED" | "REWORK_REQUIRED" | "PASSED";
  inspectedAt: string;
  note: string;
  memberVisible: boolean;
};

export type DemoShipment = {
  id: string;
  shipmentNumber: string;
  orderId: string;
  projectItemIds: string[];
  status: "IN_TRANSIT" | "DELIVERED";
  shippingMethod: "LCL";
  etd: string;
  eta: string;
  deliveredAt: string | null;
  deliveryResult: "DELIVERED_COMPLETE" | "DELIVERED_WITH_ISSUE" | null;
};

export type DemoClaim = {
  id: string;
  claimNumber: string;
  orderId: string;
  shipmentId: string;
  projectItemId: string;
  issueType: "DAMAGED_IN_TRANSIT";
  description: string;
  status: "SUBMITTED" | "REPLACEMENT_APPROVED" | "CLOSED";
  resolution: string | null;
  memberConfirmedAt: string | null;
};

export type DemoDocument = {
  id: string;
  documentNumber: string;
  type:
    | "PRODUCT_SCHEDULE_PDF"
    | "PRODUCT_SCHEDULE_XLSX"
    | "CUSTOM_QUOTATION"
    | "CUSTOMER_ORDER"
    | "PAYMENT_NOTICE"
    | "QC_REPORT"
    | "PACKING_LIST"
    | "DELIVERY_PROOF"
    | "CLAIM_RESOLUTION";
  title: string;
  visibility: "MEMBER" | "INTERNAL";
  watermark: "DEMO";
  availableFromScene: DemoSceneId;
};

export type DemoDataset = {
  organizations: DemoOrganization[];
  users: DemoUser[];
  suppliers: DemoSupplier[];
  catalog: DemoProduct[];
  project: DemoProject | null;
  projectItems: DemoProjectItem[];
  customRequests: DemoCustomRequest[];
  quotations: DemoQuotation[];
  orders: DemoOrder[];
  paymentSchedules: DemoPaymentSchedule[];
  paymentTransfers: DemoPaymentTransfer[];
  supplierOrders: DemoSupplierOrder[];
  productionEvents: DemoProductionEvent[];
  qcInspections: DemoQcInspection[];
  shipments: DemoShipment[];
  claims: DemoClaim[];
  documents: DemoDocument[];
};

export type DemoState = {
  sceneIndex: number;
  sceneId: DemoSceneId;
  activeRole: DemoRole;
  dataset: DemoDataset;
};

export type DemoDashboardSummary = {
  projects: number;
  activeOrders: number;
  paymentActions: number;
  productionDelays: number;
  shipmentsInTransit: number;
  deliveries: number;
  openClaims: number;
  actionRequired: number;
};

export type DemoExecutiveSummary = {
  grossSalesBeforeVat: string;
  factoryCost: string;
  grossProductMargin: string;
  grossProductMarginPercent: string;
  freightRevenueBeforeVat: string;
  paymentVerified: string;
};

export type DemoMemberView = {
  catalog: Array<Omit<DemoProduct, "factoryUnitCost">>;
  project: DemoProject | null;
  projectItems: DemoProjectItem[];
  customRequests: DemoCustomRequest[];
  quotations: DemoQuotation[];
  orders: DemoOrder[];
  paymentSchedules: DemoPaymentSchedule[];
  paymentTransfers: DemoPaymentTransfer[];
  productionEvents: DemoProductionEvent[];
  qcInspections: DemoQcInspection[];
  shipments: DemoShipment[];
  claims: DemoClaim[];
  documents: DemoDocument[];
};

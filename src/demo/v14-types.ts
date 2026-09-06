import type { PrototypeAction, PrototypeState } from "./prototype-types";
import type { DemoRole } from "./types";

export const V14_SCHEMA_VERSION = 4 as const;
export const V14_STORAGE_KEY = "gisp-demo-prototype-v14";

export type AdminDemoRole =
  | "GISP_ADMIN"
  | "FINANCE"
  | "QC"
  | "LOGISTICS"
  | "EXECUTIVE"
  | "SUPER_ADMIN";

export type InternalRole =
  | "MEMBER_ADMIN"
  | "PRODUCT_ADMIN"
  | "ORDER_ADMIN"
  | "PURCHASING"
  | "FINANCE"
  | "QC"
  | "LOGISTICS"
  | "EXECUTIVE_VIEWER"
  | "SUPER_ADMIN";

export type InternalUser = {
  id: string;
  fullName: string;
  email: string;
  roles: InternalRole[];
  status: "INVITED" | "ACTIVE" | "SUSPENDED";
};

export type FormulaScope = "GLOBAL" | "SUPPLIER" | "PRODUCT";
export type FormulaComponent = {
  code: "platform" | "marketing_visit" | "sourcing_catalog" | "resale_markup" | "freight_low" | "freight_high";
  name: string;
  basis: "FACTORY_COST_THB" | "MEMBER_PRICE";
  calculationType: "PERCENTAGE" | "FIXED_AMOUNT_THB";
  value: string;
  includeInMemberPrice: boolean;
  inherited: boolean;
};

export type PriceFormula = {
  id: string;
  code: string;
  scope: FormulaScope;
  supplierId: string | null;
  productId: string | null;
  version: number;
  status: "DRAFT" | "ACTIVE" | "RETIRED";
  components: FormulaComponent[];
  effectiveFrom: string;
};

export type FormulaPreview = {
  factoryCostThb: string;
  memberPrice: string;
  suggestedResalePrice: string;
  freightEstimateLow: string;
  freightEstimateHigh: string;
  componentTotal: string;
  formulaId: string;
};

export type DemoSample = {
  id: string;
  code: string;
  type: "MATERIAL_SWATCH" | "BUILT_IN_DISPLAY";
  materialName: string;
  productId: string | null;
  supplierId: string;
  memberDisplayLabel: string;
  country: "China" | "Thailand";
  city: string;
  status: "AVAILABLE" | "BORROWED" | "UNAVAILABLE";
};

export type VisitRequest = {
  id: string;
  memberProfileId: string;
  supplierId: string;
  sampleId: string;
  projectId: string;
  preferredDate: string;
  status: "SUBMITTED" | "APPROVED" | "COMPLETED" | "REJECTED" | "CANCELLED";
  meetingInstruction: string | null;
  decisionReason: string | null;
};

export type DisclosureGrant = {
  id: string;
  memberProfileId: string;
  supplierId: string;
  sourceVisitId: string;
  grantedAt: string;
  revokedAt: string | null;
  revocationReason: string | null;
};

export type WarrantySnapshot = {
  versionId: string;
  title: "Partner Warranty";
  terms: string;
  version: number;
  supplierId: string;
  snapshottedAt: string;
};

export type ClaimResponsibility = "SUPPLIER" | "LOGISTICS_INSURANCE" | "INSTALLER";

export type V14AuditEvent = {
  id: string;
  at: string;
  actor: "MEMBER" | AdminDemoRole;
  action: string;
  detail: string;
  before?: string;
  after?: string;
  reason?: string;
};

export type V14UatResult = {
  id: string;
  title: string;
  status: "NOT_TESTED" | "PASS" | "NEEDS_FIX";
  note: string;
};

export type V14State = {
  schemaVersion: typeof V14_SCHEMA_VERSION;
  workflow: PrototypeState;
  activeAdminRole: AdminDemoRole;
  internalUsers: InternalUser[];
  formulas: PriceFormula[];
  activeFormulaId: string;
  formulaPreview: FormulaPreview;
  samples: DemoSample[];
  visits: VisitRequest[];
  disclosureGrants: DisclosureGrant[];
  warrantySnapshot: WarrantySnapshot;
  suggestedResponsibility: ClaimResponsibility;
  confirmedResponsibility: ClaimResponsibility | null;
  responsibilityConfirmedBy: string | null;
  audit: V14AuditEvent[];
  uatResults: V14UatResult[];
  buildReadiness: "PENDING_DEMO_1_4_UAT" | "APPROVED_FOR_MVP_BUILD";
  lastError: string | null;
  revision: number;
};

type ActionMeta = { at: string };
export type WorkflowActionInput = PrototypeAction extends infer T
  ? T extends PrototypeAction
    ? Omit<T, "at">
    : never
  : never;

export type V14Action =
  | ({ type: "HYDRATE_V14"; state: V14State } & ActionMeta)
  | ({ type: "RESET_V14" } & ActionMeta)
  | ({ type: "SET_ADMIN_ROLE"; role: AdminDemoRole } & ActionMeta)
  | ({ type: "SET_MEMBER_ACCESS_STATUS"; decision: "SUSPEND" | "REACTIVATE"; reason: string } & ActionMeta)
  | ({ type: "RUN_WORKFLOW"; actor: DemoRole; action: WorkflowActionInput } & ActionMeta)
  | ({ type: "INVITE_INTERNAL_USER"; fullName: string; email: string } & ActionMeta)
  | ({ type: "SET_INTERNAL_ROLES"; userId: string; roles: InternalRole[] } & ActionMeta)
  | ({ type: "SET_INTERNAL_USER_STATUS"; userId: string; status: InternalUser["status"]; reason: string } & ActionMeta)
  | ({ type: "OVERRIDE_FORMULA_COMPONENT"; formulaId: string; componentCode: FormulaComponent["code"]; value: string } & ActionMeta)
  | ({ type: "PREVIEW_FORMULA"; formulaId: string; factoryCostThb: string } & ActionMeta)
  | ({ type: "ACTIVATE_FORMULA"; formulaId: string } & ActionMeta)
  | ({ type: "RETIRE_FORMULA"; formulaId: string } & ActionMeta)
  | ({ type: "SUBMIT_VISIT"; sampleId: string; preferredDate: string } & ActionMeta)
  | ({ type: "APPROVE_VISIT"; visitId: string; instruction: string } & ActionMeta)
  | ({ type: "COMPLETE_VISIT"; visitId: string } & ActionMeta)
  | ({ type: "REJECT_VISIT"; visitId: string; reason: string } & ActionMeta)
  | ({ type: "CANCEL_VISIT"; visitId: string; reason: string } & ActionMeta)
  | ({ type: "REVOKE_DISCLOSURE"; grantId: string; reason: string } & ActionMeta)
  | ({ type: "CONFIRM_CLAIM_RESPONSIBILITY"; responsibility: ClaimResponsibility } & ActionMeta)
  | ({ type: "UPDATE_V14_UAT"; resultId: string; status: V14UatResult["status"]; note: string } & ActionMeta)
  | ({ type: "SIGN_OFF_V14" } & ActionMeta);

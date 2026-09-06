export const productionRoles = [
  "MEMBER",
  "MEMBER_ADMIN",
  "PRODUCT_ADMIN",
  "ORDER_ADMIN",
  "PURCHASING",
  "FINANCE",
  "QC",
  "LOGISTICS",
  "EXECUTIVE_VIEWER",
  "SUPER_ADMIN",
] as const;

export type ProductionRole = (typeof productionRoles)[number];
export type UserStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "INACTIVE";
export type ApplicationStatus =
  | "DRAFT"
  | "PENDING"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type AppAccessContext = {
  userId: string;
  sessionId: string;
  sessionExpiresAt: string;
  userStatus: UserStatus;
  statusReason: string | null;
  applicationStatus: ApplicationStatus;
  applicationReason: string | null;
  memberProfileId: string | null;
  organizationId: string | null;
  displayName: string | null;
  companyName: string | null;
  roles: ProductionRole[];
  permissions: string[];
};

export type MemberHistoryItem = {
  item_type: "PROJECT" | "ORDER";
  item_id: string;
  reference: string;
  title: string;
  status: string;
  event_at: string;
};

export const appErrorCodes = [
  "UNAUTHENTICATED",
  "SESSION_REVOKED",
  "ACCOUNT_PENDING",
  "ACCOUNT_SUSPENDED",
  "PERMISSION_DENIED",
  "INVALID_TRANSITION",
] as const;

export type AppErrorCode = (typeof appErrorCodes)[number];


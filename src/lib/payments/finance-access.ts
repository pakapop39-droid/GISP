import "server-only";

import { cookies } from "next/headers";
import { APP_SESSION_COOKIE, AppAccessError, hashSessionToken } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function currentFinanceSessionHash() {
  const rawToken = (await cookies()).get(APP_SESSION_COOKIE)?.value;
  if (!rawToken) throw new AppAccessError("SESSION_REVOKED", 401, "เซสชันหมดอายุหรือถูกยกเลิก");
  return hashSessionToken(rawToken);
}

type PaymentPermission =
  | "payments.verify"
  | "payments.adjust";

/** Resolve the target organization before any privileged payment action. */
export async function loadAuthorizedPaymentTransfer(
  transferId: string,
  permissionCode: PaymentPermission,
) {
  const admin = createInsForgeAdminClient();
  const transfer = await admin.database.from("payment_transfers")
    .select("id,organization_id,payment_schedule_id,status")
    .eq("id", transferId).maybeSingle();
  if (transfer.error) throw transfer.error;
  if (!transfer.data?.organization_id || !transfer.data.payment_schedule_id) return null;

  const userClient = await createInsForgeServerClient();
  const permission = await userClient.database.rpc("has_permission", {
    permission_code: permissionCode,
    target_organization_id: transfer.data.organization_id,
  });
  if (permission.error) throw permission.error;
  if (permission.data !== true) return null;

  const schedule = await admin.database.from("payment_schedules")
    .select("id,organization_id,schedule_type")
    .eq("id", transfer.data.payment_schedule_id).maybeSingle();
  if (schedule.error) throw schedule.error;
  if (!schedule.data || schedule.data.organization_id !== transfer.data.organization_id) return null;

  return {
    organizationId: transfer.data.organization_id as string,
    scheduleType: schedule.data.schedule_type as string,
    status: transfer.data.status as string,
  };
}

/** Resolve the target organization before any private-file access. */
export function loadAuthorizedFinanceTransfer(transferId: string) {
  return loadAuthorizedPaymentTransfer(transferId, "payments.verify");
}

export async function loadAuthorizedPaymentAdjustment(adjustmentId: string) {
  const admin = createInsForgeAdminClient();
  const adjustment = await admin.database.from("payment_adjustments")
    .select("id,organization_id,status,payment_transfer_id")
    .eq("id", adjustmentId).maybeSingle();
  if (adjustment.error) throw adjustment.error;
  if (!adjustment.data?.organization_id) return null;

  const userClient = await createInsForgeServerClient();
  const permission = await userClient.database.rpc("has_permission", {
    permission_code: "payments.adjust",
    target_organization_id: adjustment.data.organization_id,
  });
  if (permission.error) throw permission.error;
  if (permission.data !== true) return null;

  return {
    organizationId: adjustment.data.organization_id as string,
    status: adjustment.data.status as string,
    transferId: adjustment.data.payment_transfer_id as string,
  };
}

export type PaymentHoldDecisionRole = "FINANCE" | "ORDER_ADMIN";

export async function loadAuthorizedPaymentWorkflowHold(
  holdId: string,
  role: PaymentHoldDecisionRole,
) {
  const admin = createInsForgeAdminClient();
  const hold = await admin.database.from("payment_workflow_holds")
    .select("id,organization_id,status")
    .eq("id", holdId).maybeSingle();
  if (hold.error) throw hold.error;
  if (!hold.data?.organization_id || hold.data.status !== "ACTIVE") return null;

  const userClient = await createInsForgeServerClient();
  const permission = await userClient.database.rpc("has_permission", {
    permission_code: role === "FINANCE" ? "payments.adjust" : "orders.manage",
    target_organization_id: hold.data.organization_id,
  });
  if (permission.error) throw permission.error;
  if (permission.data !== true) return null;
  return { organizationId: hold.data.organization_id as string };
}

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

/** Resolve the target organization before any private-file access. Do not use a staff profile's nullable organizationId. */
export async function loadAuthorizedFinanceTransfer(transferId: string) {
  const admin = createInsForgeAdminClient();
  const transfer = await admin.database.from("payment_transfers")
    .select("id,organization_id,payment_schedule_id,status")
    .eq("id", transferId).maybeSingle();
  if (transfer.error) throw transfer.error;
  if (!transfer.data?.organization_id || !transfer.data.payment_schedule_id) return null;

  const userClient = await createInsForgeServerClient();
  const permission = await userClient.database.rpc("has_permission", {
    permission_code: "payments.verify",
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

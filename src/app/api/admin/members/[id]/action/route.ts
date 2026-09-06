import { createServerClient } from "@insforge/sdk/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requestNetworkData } from "@/lib/auth/auth-route";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), note: z.string().trim().max(500).default("") }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("suspend"), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("reactivate") }),
  z.object({ action: z.literal("force-logout") }),
  z.object({ action: z.literal("send-reset") }),
]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !parsed.success) return invalidInput();
  try {
    let message = "ดำเนินการเรียบร้อยแล้ว";
    const insforge = await createInsForgeServerClient();
    if (parsed.data.action === "approve") {
      await requireAppAccess({ permissions: ["members.approve"] });
      const result = await insforge.database.rpc("approve_member_application", { application_id_input: id, review_note_input: parsed.data.note || null });
      if (result.error) throw result.error;
    } else if (parsed.data.action === "reject") {
      await requireAppAccess({ permissions: ["members.approve"] });
      const result = await insforge.database.rpc("reject_member_application", { application_id_input: id, reason_input: parsed.data.reason });
      if (result.error) throw result.error;
    } else if (parsed.data.action === "suspend") {
      await requireAppAccess({ permissions: ["members.suspend"] });
      const result = await insforge.database.rpc("suspend_user", { target_user_id_input: id, reason_input: parsed.data.reason });
      if (result.error) throw result.error;
    } else if (parsed.data.action === "reactivate") {
      await requireAppAccess({ permissions: ["members.suspend"] });
      const result = await insforge.database.rpc("reactivate_user", { target_user_id_input: id });
      if (result.error) throw result.error;
    } else if (parsed.data.action === "force-logout") {
      await requireAppAccess({ permissions: ["sessions.force_logout"] });
      const result = await insforge.database.rpc("revoke_all_app_sessions", { target_user_id_input: id, reason_input: "ADMIN_FORCE_LOGOUT" });
      if (result.error) throw result.error;
    } else {
      await requireAppAccess({ permissions: ["members.reset_password"] });
      const emailResult = await insforge.database.rpc("admin_get_user_email", { target_user_id_input: id });
      if (emailResult.error || !emailResult.data) throw emailResult.error ?? new Error("USER_NOT_FOUND");
      const auth = createServerClient();
      const resetResult = await auth.auth.sendResetPasswordEmail({ email: String(emailResult.data), redirectTo: new URL("/reset-password", process.env.NEXT_PUBLIC_APP_URL ?? request.url).toString() });
      if (resetResult.error) throw resetResult.error;
      const network = requestNetworkData(request);
      const securityResult = await insforge.database.rpc("write_security_event", {
        event_type_input: "PASSWORD_RESET_REQUESTED",
        outcome_input: "SUCCESS",
        target_user_id_input: id,
        request_id_input: network.requestId,
        ip_address_input: network.ip,
        user_agent_input: network.userAgent,
        metadata_input: { source: "ADMIN" },
      });
      if (securityResult.error) throw securityResult.error;
      message = "ส่งลิงก์เปลี่ยนรหัสผ่านแล้ว กรุณาตรวจกล่องจดหมายและ Spam";
    }
    return NextResponse.json({ message });
  } catch (error) {
    return apiError(error);
  }
}

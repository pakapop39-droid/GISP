import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/session";
import { apiError, invalidInput } from "@/lib/api/response";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { productionRoles } from "@/lib/auth/types";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) return invalidInput();
    const admin = createInsForgeAdminClient();
    const roles = await admin.database.from("user_roles").select("roles(code)")
      .eq("user_id", id).is("organization_id", null).is("revoked_at", null);
    if (roles.error) throw roles.error;
    const rows = roles.data as unknown as { roles: { code: string } | null }[];
    const staffRoles: readonly string[] = productionRoles.filter((role) => role !== "MEMBER");
    if (!rows.some((row) => staffRoles.includes(row.roles?.code ?? ""))) {
      return NextResponse.json({ message: "ไม่พบบัญชีพนักงานนี้" }, { status: 404 });
    }
    const server = await createInsForgeServerClient();
    const email = await server.database.rpc("admin_get_user_email", { target_user_id_input: id });
    if (email.error) throw email.error;
    if (!email.data) return NextResponse.json({ message: "ไม่พบอีเมลของพนักงาน" }, { status: 404 });
    const result = await admin.auth.sendResetPasswordEmail({
      email: String(email.data),
      redirectTo: new URL("/reset-password", process.env.NEXT_PUBLIC_APP_URL ?? request.url).toString(),
    });
    if (result.error) throw result.error;
    return NextResponse.json({ message: "ระบบรับคำขอส่งลิงก์แล้ว ให้พนักงานตรวจกล่องจดหมายและจดหมายขยะ แล้วเปิดลิงก์เพื่อตั้งรหัสใหม่" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

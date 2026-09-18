import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/session";
import { apiError, invalidInput } from "@/lib/api/response";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { productionRoles, type ProductionRole } from "@/lib/auth/types";
import { staffJobGroupsForRoles } from "@/lib/auth/staff-job-groups";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireSuperAdmin();
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) return invalidInput();
    if (id === access.userId) {
      return NextResponse.json({ message: "ไม่สามารถจัดการบัญชีของตนเองจากหน้านี้ได้" }, { status: 409 });
    }
    const admin = createInsForgeAdminClient();
    const [user, roles] = await Promise.all([
      admin.database.from("users").select("id,status,primary_organization_id")
        .eq("id", id).maybeSingle(),
      admin.database.from("user_roles").select("roles(code)")
        .eq("user_id", id).is("organization_id", null).is("revoked_at", null),
    ]);
    if (user.error) throw user.error;
    if (roles.error) throw roles.error;
    const rows = roles.data as unknown as { roles: { code: string } | null }[];
    const activeRoles = rows.map((row) => row.roles?.code).filter(
      (code): code is ProductionRole => Boolean(code) && productionRoles.includes(code as ProductionRole),
    );
    const target = user.data as { id: string; status: string; primary_organization_id: string | null } | null;
    if (!target || target.primary_organization_id !== null || !["ACTIVE", "SUSPENDED"].includes(target.status)
      || activeRoles.length === 0) {
      return NextResponse.json({ message: "ไม่พบบัญชีพนักงานนี้" }, { status: 404 });
    }
    if (activeRoles.includes("SUPER_ADMIN")) {
      return NextResponse.json({ message: "บัญชีเจ้าของระบบได้รับการป้องกันและจัดการจากหน้านี้ไม่ได้" }, { status: 409 });
    }
    if (activeRoles.length !== rows.length || staffJobGroupsForRoles(activeRoles) === null) {
      return NextResponse.json({ message: "บัญชีนี้มีสิทธิ์เฉพาะหรือชุดสิทธิ์ไม่สมบูรณ์ จึงต้องให้ทีมเทคนิคตรวจสอบก่อน" }, { status: 409 });
    }
    const server = await createInsForgeServerClient();
    const email = await server.database.rpc("admin_get_staff_user_email", { target_user_id_input: id });
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

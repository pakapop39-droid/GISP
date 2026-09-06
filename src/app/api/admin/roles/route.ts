import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireSuperAdmin } from "@/lib/auth/session";
import { productionRoles } from "@/lib/auth/types";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const patchSchema = z.object({ role: z.enum(productionRoles), permission: z.string().min(3).max(100), enabled: z.boolean(), confirmed: z.literal(true) });

export async function GET() {
  try {
    await requireSuperAdmin();
    const admin = createInsForgeAdminClient();
    const [roles, permissions, matrix] = await Promise.all([
      admin.database.from("roles").select("id,code,name,description").order("code"),
      admin.database.from("permissions").select("id,code,name,description").order("code"),
      admin.database.from("role_permissions").select("role_id,permission_id"),
    ]);
    if (roles.error) throw roles.error;
    if (permissions.error) throw permissions.error;
    if (matrix.error) throw matrix.error;
    return NextResponse.json({ data: { roles: roles.data, permissions: permissions.data, matrix: matrix.data } });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInput();
  try {
    await requireSuperAdmin();
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("set_role_permission", { role_code_input: parsed.data.role, permission_code_input: parsed.data.permission, enabled_input: parsed.data.enabled });
    if (error) throw error;
    return NextResponse.json({ data, message: "อัปเดต Permission Matrix แล้ว" });
  } catch (error) {
    return apiError(error);
  }
}

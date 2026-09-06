import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { internalUserCreateSchema } from "@/lib/auth/internal-user-schema";
import { requireSuperAdmin } from "@/lib/auth/session";
import { rolesForStaffJobGroup } from "@/lib/auth/staff-job-groups";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function POST(request: NextRequest) {
  const parsed = internalUserCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
  try {
    await requireSuperAdmin();
    const admin = createInsForgeAdminClient();
    const created = await admin.auth.signUp({ email: parsed.data.email, password: parsed.data.temporaryPassword, name: parsed.data.name, autoConfirm: true });
    if (created.error) throw created.error;
    let userId = created.data?.user?.id;
    if (!userId) {
      const lookup = await admin.database.rpc("operator_find_auth_user_id", { email_input: parsed.data.email });
      if (lookup.error || !lookup.data) throw lookup.error ?? new Error("CREATE_USER_FAILED");
      userId = String(lookup.data);
    }
    const insforge = await createInsForgeServerClient();
    const provisioned = await insforge.database.rpc("provision_internal_user", {
      target_user_id_input: userId,
      full_name_input: parsed.data.name,
      role_codes_input: [...new Set(parsed.data.jobGroups.flatMap(rolesForStaffJobGroup))],
    });
    if (provisioned.error) throw provisioned.error;
    return NextResponse.json({ data: { id: userId }, message: "สร้างผู้ใช้ภายในแล้ว" }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

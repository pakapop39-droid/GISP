import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireRfqAdmin } from "@/lib/custom-rfq/server";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

export async function GET() {
  try {
    await requireRfqAdmin();
    const admin = createInsForgeAdminClient();
    const [suppliers, roles, userRoles, users] = await Promise.all([
      admin.database.from("suppliers").select("id,code,name,status").in("status", ["PROSPECT", "ACTIVE"]).order("name").limit(500),
      admin.database.from("roles").select("id,code").limit(50),
      admin.database.from("user_roles").select("user_id,role_id,revoked_at").is("revoked_at", null).limit(1000),
      admin.database.from("users").select("id,full_name,status").eq("status", "ACTIVE").order("full_name").limit(500),
    ]);
    for (const result of [suppliers, roles, userRoles, users]) if (result.error) throw result.error;
    const internalRoleIds = new Set((roles.data ?? []).filter((role) => role.code !== "MEMBER").map((role) => role.id));
    const internalUserIds = new Set((userRoles.data ?? []).filter((row) => internalRoleIds.has(row.role_id)).map((row) => row.user_id));
    return NextResponse.json({ data: {
      suppliers: suppliers.data ?? [], users: (users.data ?? []).filter((user) => internalUserIds.has(user.id)),
    } });
  } catch (error) { return apiError(error); }
}

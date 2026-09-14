import "server-only";

import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { productionRoles, type ProductionRole, type UserStatus } from "./types";

export type InternalUser = {
  id: string;
  full_name: string;
  email: string;
  status: UserStatus;
  roles: ProductionRole[];
};

// Call only after requireSuperAdmin. Read active, organization-independent roles.
export async function listInternalUsers(): Promise<InternalUser[]> {
  const admin = createInsForgeAdminClient();
  const server = await createInsForgeServerClient();
  const byUser = new Map<string, ProductionRole[]>();
  for (let offset = 0; ; offset += 200) {
    const result = await admin.database.from("user_roles")
      .select("id,user_id,roles(code)").is("revoked_at", null).is("organization_id", null)
      .order("id").range(offset, offset + 199);
    if (result.error) throw result.error;
    const rows = result.data as unknown as { user_id: string; roles: { code: ProductionRole } | null }[];
    for (const row of rows) {
      const role = row.roles?.code;
      if (!role || role === "MEMBER" || !productionRoles.includes(role)) continue;
      byUser.set(row.user_id, [...new Set([...(byUser.get(row.user_id) ?? []), role])]);
    }
    if (rows.length < 200) break;
  }
  const users: InternalUser[] = [];
  const ids = [...byUser.keys()];
  for (let offset = 0; offset < ids.length; offset += 50) {
    const result = await admin.database.from("users").select("id,full_name,status")
      .in("id", ids.slice(offset, offset + 50));
    if (result.error) throw result.error;
    const rows = result.data as { id: string; full_name: string; status: UserStatus }[];
    users.push(...await Promise.all(rows.map(async (user) => {
      const email = await server.database.rpc("admin_get_user_email", { target_user_id_input: user.id });
      if (email.error) throw email.error;
      return { ...user, email: String(email.data ?? ""), roles: byUser.get(user.id)! };
    })));
  }
  return users.sort((a, b) => a.full_name.localeCompare(b.full_name, "th") || a.id.localeCompare(b.id));
}

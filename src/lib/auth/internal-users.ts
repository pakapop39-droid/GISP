import "server-only";

import { createInsForgeServerClient } from "@/lib/insforge/server";
import { type ProductionRole, type UserStatus } from "./types";

export type InternalUser = {
  id: string;
  full_name: string;
  email: string;
  status: UserStatus;
  roles: ProductionRole[];
};

// Call only after requireSuperAdmin. Include deactivated historical staff records,
// while returning only their currently active roles.
export async function listInternalUsers(): Promise<InternalUser[]> {
  const server = await createInsForgeServerClient();
  const result = await server.database.rpc("list_internal_staff_users");
  if (result.error) throw result.error;

  const rows = (result.data ?? []) as {
    id: string;
    full_name: string;
    email: string | null;
    status: UserStatus;
    roles: ProductionRole[] | null;
  }[];
  const users = rows.map((row): InternalUser => ({
    id: row.id,
    full_name: row.full_name,
    email: row.email ?? "",
    status: row.status,
    roles: row.roles ?? [],
  }));
  return users.sort((a, b) => a.full_name.localeCompare(b.full_name, "th") || a.id.localeCompare(b.id));
}

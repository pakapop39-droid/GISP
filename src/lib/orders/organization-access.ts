import "server-only";

import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function hasTargetOrganizationPermission(permission: string, organizationId: string) {
  const client = await createInsForgeServerClient();
  const result = await client.database.rpc("has_permission", {
    permission_code: permission,
    target_organization_id: organizationId,
  });
  if (result.error) throw result.error;
  return result.data === true;
}

export async function targetOrganizationPermissions(permissions: readonly string[], organizationId: string) {
  const checks = await Promise.all(permissions.map(async (permission) => ({
    permission,
    granted: await hasTargetOrganizationPermission(permission, organizationId),
  })));
  return checks.filter((check) => check.granted).map((check) => check.permission);
}

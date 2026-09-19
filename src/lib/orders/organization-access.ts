import "server-only";

import { createInsForgeServerClient } from "@/lib/insforge/server";
import { readOnlyRpcWithSocketRetry } from "./read-only-rpc";

type ServerClient = Awaited<ReturnType<typeof createInsForgeServerClient>>;

async function checkTargetOrganizationPermission(
  client: ServerClient,
  permission: string,
  organizationId: string,
) {
  const result = await readOnlyRpcWithSocketRetry(() => client.database.rpc(
    "has_permission",
    { permission_code: permission, target_organization_id: organizationId },
  ));
  if (result.error) throw result.error;
  return result.data === true;
}

export async function hasTargetOrganizationPermission(permission: string, organizationId: string) {
  const client = await createInsForgeServerClient();
  return checkTargetOrganizationPermission(client, permission, organizationId);
}

export async function targetOrganizationPermissions(
  permissions: readonly string[],
  organizationId: string,
) {
  const client = await createInsForgeServerClient();
  const granted: string[] = [];
  // Reuse one authenticated client and avoid bursting multiple permission RPCs.
  // A burst can exhaust the local SSR transport and surface as a socket hang up.
  for (const permission of permissions) {
    if (await checkTargetOrganizationPermission(client, permission, organizationId)) {
      granted.push(permission);
    }
  }
  return granted;
}

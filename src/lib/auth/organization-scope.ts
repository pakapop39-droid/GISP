import type { AppAccessContext } from "@/lib/auth/types";

export type OrganizationPermissionScope = {
  global: boolean;
  organizationIds: string[];
};

function matchingScopes(
  context: Pick<AppAccessContext, "permissionScopes">,
  permissionCodes: readonly string[],
) {
  const allowed = new Set(permissionCodes);
  return (context.permissionScopes ?? []).filter((scope) => allowed.has(scope.code));
}

export function organizationScopeForPermissions(
  context: Pick<AppAccessContext, "permissionScopes">,
  permissionCodes: readonly string[],
): OrganizationPermissionScope {
  const scopes = matchingScopes(context, permissionCodes);
  return {
    global: scopes.some((scope) => scope.organizationId === null),
    organizationIds: [...new Set(scopes.flatMap((scope) => scope.organizationId ? [scope.organizationId] : []))],
  };
}

export function permissionsForOrganization(
  context: Pick<AppAccessContext, "permissionScopes">,
  organizationId: string,
) {
  return [...new Set((context.permissionScopes ?? [])
    .filter((scope) => scope.organizationId === null || scope.organizationId === organizationId)
    .map((scope) => scope.code))];
}

export function hasAllPermissionsForOrganization(
  context: Pick<AppAccessContext, "permissionScopes">,
  permissionCodes: readonly string[],
  organizationId: string,
) {
  const effective = new Set(permissionsForOrganization(context, organizationId));
  return permissionCodes.every((permission) => effective.has(permission));
}

export function hasAnyPermissionForOrganization(
  context: Pick<AppAccessContext, "permissionScopes">,
  permissionCodes: readonly string[],
  organizationId: string,
) {
  const effective = new Set(permissionsForOrganization(context, organizationId));
  return permissionCodes.some((permission) => effective.has(permission));
}

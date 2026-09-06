import type { AppAccessContext, ProductionRole } from "@/lib/auth/types";

export function isStaffRole(role: ProductionRole) {
  return role !== "MEMBER";
}

export function accessHome(context: AppAccessContext) {
  if (context.userStatus === "SUSPENDED") return "/account-suspended";
  if (context.applicationStatus === "REJECTED") return "/application-rejected";
  const staff = context.roles.some(isStaffRole);
  if (
    context.userStatus !== "ACTIVE" ||
    (!staff && context.applicationStatus !== "APPROVED")
  ) {
    return context.memberProfileId ? "/pending-approval" : "/onboarding";
  }
  return staff ? "/admin/dashboard" : "/member/dashboard";
}

export function hasAllPermissions(
  context: Pick<AppAccessContext, "permissions">,
  required: string[],
) {
  return required.every((permission) => context.permissions.includes(permission));
}


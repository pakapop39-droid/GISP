import { CatalogWorkspace } from "@/components/catalog-workspace";
import { requireAppAccess } from "@/lib/auth/session";

export default async function CatalogPage() {
  const context = await requireAppAccess({ permissions: ["catalog.read"] });
  return (
    <CatalogWorkspace
      canManage={context.permissions.includes("catalog.manage")}
      canReadCost={context.permissions.includes("catalog.cost.read")}
      canManageCost={context.permissions.includes("catalog.cost.manage")}
      canManageFormula={context.permissions.includes("catalog.formula.manage")}
    />
  );
}

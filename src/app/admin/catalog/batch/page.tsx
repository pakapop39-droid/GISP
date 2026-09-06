import { BatchCatalogWorkspace } from "@/components/batch-catalog-workspace";
import { requireAppAccess } from "@/lib/auth/session";

export default async function CatalogBatchPage() {
  const context = await requireAppAccess({ permissions: ["catalog.read"] });
  return (
    <BatchCatalogWorkspace
      canManage={context.permissions.includes("catalog.manage")}
      canManageCost={context.permissions.includes("catalog.cost.manage")}
      canManageFormula={context.permissions.includes("catalog.formula.manage")}
    />
  );
}

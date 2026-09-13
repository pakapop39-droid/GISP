import { CatalogWorkspace } from "@/components/catalog-workspace";
import { requireAppAccess } from "@/lib/auth/session";
import { resolveCatalogNavigation } from "@/lib/catalog/catalog-navigation";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ productId?: string; tab?: string }> }) {
  const query = await searchParams;
  const navigation = resolveCatalogNavigation(query);
  const context = await requireAppAccess({ permissions: ["catalog.read"] });
  return (
    <CatalogWorkspace
      canManage={context.permissions.includes("catalog.manage")}
      canReadCost={context.permissions.includes("catalog.cost.read")}
      canManageCost={context.permissions.includes("catalog.cost.manage")}
      canManageFormula={context.permissions.includes("catalog.formula.manage")}
      initialProductId={navigation.initialProductId}
      initialTab={navigation.initialTab}
    />
  );
}

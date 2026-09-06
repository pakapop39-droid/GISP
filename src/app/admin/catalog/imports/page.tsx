import { CatalogImportWorkspace } from "@/components/catalog-import-workspace";
import { requireAppAccess } from "@/lib/auth/session";

export default async function CatalogImportPage() {
  const context = await requireAppAccess({ permissions: ["catalog.import"] });
  return <CatalogImportWorkspace canImport canManage={context.permissions.includes("catalog.manage")} />;
}

import { CatalogImportWorkspace } from "@/components/catalog-import-workspace";
import { requireAppAccess } from "@/lib/auth/session";
import { isPdfCatalogImportEnabled } from "@/lib/catalog/pdf-import";

export default async function CatalogImportPage() {
  const context = await requireAppAccess({ permissions: ["catalog.import"] });
  return <CatalogImportWorkspace canImport canManage={context.permissions.includes("catalog.manage")} pdfEnabled={isPdfCatalogImportEnabled()} />;
}

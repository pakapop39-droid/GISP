import { CatalogImportWorkspace } from "@/components/catalog-import-workspace";
import { requireAppAccess } from "@/lib/auth/session";
import { isPdfCatalogImportEnabled } from "@/lib/catalog/pdf-import";
import { isCatalogExcelRoundtripEnabled } from "@/lib/catalog/excel-roundtrip";

export default async function CatalogImportPage() {
  const context = await requireAppAccess({ permissions: ["catalog.import"] });
  return <CatalogImportWorkspace canImport canManage={context.permissions.includes("catalog.manage")} canReadCosts={context.permissions.includes("catalog.cost.read")} canManageCosts={context.permissions.includes("catalog.cost.manage")} pdfEnabled={isPdfCatalogImportEnabled()} excelRoundtripEnabled={isCatalogExcelRoundtripEnabled()} />;
}

import { catalogImportTemplateCsv } from "@/lib/catalog/import-file";
import { requireAppAccess } from "@/lib/auth/session";
import { apiError } from "@/lib/api/response";

export async function GET() {
  try {
    await requireAppAccess({ permissions: ["catalog.import"] });
    return new Response(catalogImportTemplateCsv(), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="gisp-catalog-import-template.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

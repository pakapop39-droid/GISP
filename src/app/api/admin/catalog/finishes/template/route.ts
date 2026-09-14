import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { finishImportTemplateCsv } from "@/lib/catalog/finish-import";

export async function GET() {
  try {
    await requireAppAccess({ permissions: ["catalog.import"] });
    return new Response(finishImportTemplateCsv(), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="gisp-finish-import-template.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}


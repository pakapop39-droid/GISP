import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import {
  fixedReportToCsv,
  parseReportFilters,
  reportFileName,
} from "@/modules/reports/presentation";
import {
  getFixedReport,
  recordFixedReportExport,
} from "@/modules/reports/repository";

export async function GET(request: Request) {
  try {
    await requireAppAccess({ permissions: ["reports.fixed.read"] });
    const url = new URL(request.url);
    const filters = parseReportFilters(
      Object.fromEntries(url.searchParams.entries()),
    );
    const report = await getFixedReport(filters);
    if (url.searchParams.get("format") === "csv") {
      await requireAppAccess({ permissions: ["reports.fixed.export"] });
      await recordFixedReportExport(report);
      return new Response(fixedReportToCsv(report), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${reportFileName(report)}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    return Response.json(
      { data: report },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

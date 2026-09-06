import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { getExecutiveDashboard } from "@/modules/reports/repository";

export async function GET(request: Request) {
  try {
    await requireAppAccess({ permissions: ["reports.executive.read"] });
    const url = new URL(request.url);
    const today = new Date().toISOString().slice(0, 10);
    const from = url.searchParams.get("from") ?? `${today.slice(0, 4)}-01-01`;
    const to = url.searchParams.get("to") ?? today;
    return Response.json(
      { data: await getExecutiveDashboard(from, to) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

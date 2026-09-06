import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { getAdminOperationsDashboard } from "@/modules/reports/repository";

export async function GET() {
  try {
    await requireAppAccess({ permissions: ["reports.fixed.read"] });
    return Response.json(
      { data: await getAdminOperationsDashboard() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

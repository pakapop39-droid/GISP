import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { getAdminOperationsDashboard } from "@/modules/reports/repository";
import { enabledReleaseDSlices } from "@/lib/release-stage";
import { projectAdminDashboardForRelease } from "@/modules/reports/release-projection";

export async function GET() {
  try {
    await requireAppAccess({ permissions: ["reports.fixed.read"] });
    return Response.json(
      { data: projectAdminDashboardForRelease(
        await getAdminOperationsDashboard(), process.env.RELEASE_STAGE,
        process.env.RELEASE_STAGE === "D" ? enabledReleaseDSlices() : [],
      ) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

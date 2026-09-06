import { AdminShowroomVisits } from "@/components/admin-showroom-visits";
import { requireAppAccess } from "@/lib/auth/session";

export default async function AdminShowroomVisitsPage() {
  const context = await requireAppAccess({ active: true, permissions: ["visits.manage"] });
  return <AdminShowroomVisits canRevoke={context.roles.includes("SUPER_ADMIN")} />;
}

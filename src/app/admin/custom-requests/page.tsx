import { AdminCustomRequestList } from "@/components/admin-custom-request-list";
import { requireAppAccess } from "@/lib/auth/session";

export default async function AdminCustomRequestsPage() {
  await requireAppAccess({ active: true, permissions: ["rfq.manage"] });
  return <AdminCustomRequestList/>;
}

import { AdminCustomRequestDetail } from "@/components/admin-custom-request-detail";
import { requireAppAccess } from "@/lib/auth/session";

export default async function AdminCustomRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAppAccess({ active: true, permissions: ["rfq.manage"] });
  const { id } = await params;
  return <AdminCustomRequestDetail requestId={id}/>;
}

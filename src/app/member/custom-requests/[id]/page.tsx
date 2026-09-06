import { MemberCustomRequestDetail } from "@/components/member-custom-request-detail";
import { requireAppAccess } from "@/lib/auth/session";

export default async function CustomRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAppAccess({ active: true });
  const { id } = await params;
  return <MemberCustomRequestDetail requestId={id}/>;
}

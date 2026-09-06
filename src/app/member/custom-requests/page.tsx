import { MemberCustomRequestList } from "@/components/member-custom-request-list";
import { requireAppAccess } from "@/lib/auth/session";

export default async function MemberCustomRequestsPage() {
  await requireAppAccess({ active: true });
  return <MemberCustomRequestList/>;
}

import { MemberSharedCatalogsWorkspace } from "@/components/member-shared-catalogs-workspace";
import { requireAppAccess } from "@/lib/auth/session";

export default async function Page() {
  await requireAppAccess({ active: true });
  return <MemberSharedCatalogsWorkspace />;
}


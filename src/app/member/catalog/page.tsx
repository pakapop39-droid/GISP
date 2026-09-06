import { MemberCatalogWorkspace } from "@/components/member-catalog-workspace";
import { requireAppAccess } from "@/lib/auth/session";

export default async function MemberCatalogPage() {
  await requireAppAccess({ active: true });
  return <MemberCatalogWorkspace />;
}

import { MemberCatalogWorkspace } from "@/components/member-catalog-workspace";
import { requireAppAccess } from "@/lib/auth/session";
import { imageSearchPreviewEnabled } from "@/lib/catalog/image-search-server";

export default async function MemberCatalogPage() {
  await requireAppAccess({ active: true });
  return <MemberCatalogWorkspace imageSearchEnabled={imageSearchPreviewEnabled()} />;
}

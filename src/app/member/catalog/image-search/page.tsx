import { notFound } from "next/navigation";
import { MemberImageSearch } from "@/components/member-image-search";
import { requireAppAccess } from "@/lib/auth/session";
import { imageSearchDatabaseEnabled, imageSearchPreviewEnabled } from "@/lib/catalog/image-search-server";

export default async function ImageSearchPage() {
  if (!imageSearchPreviewEnabled()) notFound();
  await requireAppAccess({ active: true });
  return <MemberImageSearch databaseMode={imageSearchDatabaseEnabled()} />;
}

import { notFound } from "next/navigation";
import { SharedCatalogPublicView } from "@/components/shared-catalog-public-view";
import { loadMemberSharedCatalogPreview, requireMember } from "@/lib/shared-catalog/server";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireMember();
  const { id } = await params;
  const data = await loadMemberSharedCatalogPreview(id, context.memberProfileId ?? "");
  if (!data) notFound();
  return <SharedCatalogPublicView data={data} preview dataUrl={`/api/member/shared-catalogs/${id}/preview`} storageKey={`preview-${id}`} />;
}

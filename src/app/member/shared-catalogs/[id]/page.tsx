import { MemberSharedCatalogEditor } from "@/components/member-shared-catalog-editor";
import { requireAppAccess } from "@/lib/auth/session";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAppAccess({ active: true });
  const { id } = await params;
  return <MemberSharedCatalogEditor catalogId={id} />;
}


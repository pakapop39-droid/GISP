import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedCatalogPublicView } from "@/components/shared-catalog-public-view";
import { loadPublicSharedCatalog } from "@/lib/shared-catalog/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/.test(token)) notFound();
  const data = await loadPublicSharedCatalog(token);
  if (!data) notFound();
  return <SharedCatalogPublicView data={data} dataUrl={`/api/public/catalogs/${token}`} storageKey={token} />;
}

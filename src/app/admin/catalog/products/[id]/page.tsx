import { ProductDetailWorkspace } from "@/components/product-detail-workspace";
import { requireAppAccess } from "@/lib/auth/session";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireAppAccess({ permissions: ["catalog.read"] });
  return <ProductDetailWorkspace productId={id} canManage={context.permissions.includes("catalog.manage")} canPublish={context.permissions.includes("catalog.publish")} />;
}

import { MemberProductDetail } from "@/components/member-product-detail";
import { requireAppAccess } from "@/lib/auth/session";

export default async function MemberProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAppAccess({ active: true });
  const { id } = await params;
  return <MemberProductDetail productId={id} />;
}

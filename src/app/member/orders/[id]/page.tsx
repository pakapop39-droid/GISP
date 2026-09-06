import { MemberOrderDetail } from "@/components/member-order-detail";

export default async function MemberOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemberOrderDetail orderId={id}/>;
}

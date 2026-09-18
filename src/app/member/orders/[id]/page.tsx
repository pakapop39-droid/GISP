import { MemberOrderDetail } from "@/components/member-order-detail";
import { isOrderOperationSliceVisible } from "@/lib/release-stage";

export default async function MemberOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemberOrderDetail orderId={id} showProductionQc={isOrderOperationSliceVisible(7)} showLogistics={isOrderOperationSliceVisible(8)}/>;
}

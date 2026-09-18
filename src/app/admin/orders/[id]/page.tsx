import { AdminOrderDetail } from "@/components/admin-order-detail";
import { isOrderOperationSliceVisible } from "@/lib/release-stage";

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminOrderDetail orderId={id} showProductionQc={isOrderOperationSliceVisible(7)} showLogistics={isOrderOperationSliceVisible(8)}/>;
}

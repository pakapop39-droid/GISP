import { AdminOrderDetail } from "@/components/admin-order-detail";

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminOrderDetail orderId={id}/>;
}

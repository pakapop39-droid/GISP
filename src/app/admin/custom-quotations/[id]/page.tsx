import { AdminQuotationDetail } from "@/components/admin-quotation-detail";

export default async function AdminQuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminQuotationDetail quotationId={id}/>;
}

import { MemberQuotationDetail } from "@/components/member-quotation-detail";

export default async function MemberQuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemberQuotationDetail quotationId={id}/>;
}

import { AdminClaimDetail } from "@/components/admin-claim-detail";
export default async function AdminClaimPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <AdminClaimDetail claimId={id}/>; }

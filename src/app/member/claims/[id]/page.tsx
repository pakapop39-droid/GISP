import { MemberClaimDetail } from "@/components/member-claim-detail";
export default async function MemberClaimPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <MemberClaimDetail claimId={id}/>; }

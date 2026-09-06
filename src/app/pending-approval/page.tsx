import { redirect } from "next/navigation";
import { AccountStatusPage } from "@/components/account-status-page";
import { ApplicationUpload } from "@/components/account-status-actions";
import { accessHome, readAppAccessContext } from "@/lib/auth/session";
import { PendingMemberDashboard } from "@/components/pending-member-dashboard";

export default async function PendingPage() {
  const context = await readAppAccessContext();
  if (!context) redirect("/login");

  const home = accessHome(context);
  if (home !== "/pending-approval") redirect(home);

  if (context.applicationStatus === "PENDING" || context.applicationStatus === "UNDER_REVIEW") {
    return <PendingMemberDashboard context={context} />;
  }

  return (
    <AccountStatusPage
      eyebrow="Pending approval"
      title="ทีม GISP ได้รับคำขอแล้ว"
      description="ระหว่างตรวจสอบ คุณยังดูและเพิ่มเอกสารสมัครได้ แต่ยังไม่เห็นราคาและยังสร้าง Project หรือ Order ไม่ได้"
      tone="warn"
    >
      <ApplicationUpload />
    </AccountStatusPage>
  );
}

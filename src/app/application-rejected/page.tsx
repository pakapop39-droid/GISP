import { redirect } from "next/navigation";
import { AccountStatusPage } from "@/components/account-status-page";
import { accessHome, readAppAccessContext } from "@/lib/auth/session";

export default async function RejectedPage() {
  const context = await readAppAccessContext();
  if (!context) redirect("/login");

  const home = accessHome(context);
  if (home !== "/application-rejected") redirect(home);

  return (
    <AccountStatusPage
      eyebrow="Revision required"
      title="คำขอต้องแก้ข้อมูลก่อนส่งใหม่"
      description="ตรวจเหตุผลด้านล่าง แก้ข้อมูลบริษัทให้ครบ แล้วส่งคำขอกลับเข้าสู่คิวตรวจอีกครั้ง"
      tone="bad"
      reason={context.applicationReason}
      editHref="/onboarding?edit=1"
    />
  );
}

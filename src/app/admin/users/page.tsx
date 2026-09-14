import { AdminUsersWorkspace } from "@/components/admin-users-workspace";
import { requireSuperAdmin } from "@/lib/auth/session";

export default async function AdminUsersPage(){
  await requireSuperAdmin();
  return <><section className="v14-hero"><div><p className="v14-eyebrow">Staff provisioning</p><h1>จัดการบัญชีพนักงาน</h1><p>สร้างบัญชีและค้นหารายชื่อพนักงานตามกลุ่มงานที่รับผิดชอบ</p></div></section><AdminUsersWorkspace/></>;
}

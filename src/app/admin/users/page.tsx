import { AdminUsersForm } from "@/components/admin-users-form";
import { requireSuperAdmin } from "@/lib/auth/session";

export default async function AdminUsersPage(){
  await requireSuperAdmin();
  return <><section className="v14-hero"><div><p className="v14-eyebrow">Staff provisioning</p><h1>สร้างบัญชีพนักงาน</h1><p>เลือกกลุ่มงานตามหน้าที่ ระบบจะกำหนดสิทธิ์ย่อยที่จำเป็นให้อัตโนมัติ</p></div></section><AdminUsersForm/></>;
}

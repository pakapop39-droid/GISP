import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  join(process.cwd(), "src/components/admin-users-workspace.tsx"),
  "utf8",
);

describe("admin users workspace contract", () => {
  it("keeps search and password-reset while exposing approved staff actions", () => {
    expect(component).toContain("ค้นหาชื่อหรืออีเมล");
    expect(component).toContain("ส่งลิงก์ตั้งรหัส");
    expect(component).toContain("แก้กลุ่มงาน");
    expect(component).toContain("ระงับ");
    expect(component).toContain("เปิดใช้งาน");
    expect(component).toContain("ปิดบัญชี");
  });

  it("disables protected accounts and requires typed email for deactivation", () => {
    expect(component).toContain('user.id === currentUserId');
    expect(component).toContain('user.roles.includes("SUPER_ADMIN")');
    expect(component).toContain("staffJobGroupsForRoles(user.roles) === null");
    expect(component).toContain("สิทธิ์เฉพาะหรือชุดสิทธิ์ไม่สมบูรณ์");
    expect(component).toContain("confirmationEmail.trim().toLocaleLowerCase()");
    expect(component).toContain("พิมพ์อีเมลพนักงานเพื่อยืนยัน");
  });

  it("reloads server truth after a successful action", () => {
    expect(component).toContain("await loadUsers()");
    expect(component).toContain('fetch("/api/admin/users", { cache: "no-store" })');
  });
});

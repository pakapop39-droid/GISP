import { execFileSync } from "node:child_process";

export const UAT_ADMIN_EMAIL = "uat-admin-all@gisp.example.com";
export const UAT_MEMBER_EMAIL = "uat-member-all@gisp.example.com";

export function getUatPassword() {
  if (process.env.GISP_UAT_PASSWORD) return process.env.GISP_UAT_PASSWORD;

  let output;
  try {
    output = process.platform === "win32"
      ? execFileSync(
          "powershell.exe",
          ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "npx -y @insforge/cli secrets get GISP_UAT_PASSWORD --json"],
          { encoding: "utf8", windowsHide: true },
        )
      : execFileSync(
          "npx",
          ["-y", "@insforge/cli", "secrets", "get", "GISP_UAT_PASSWORD", "--json"],
          { encoding: "utf8" },
        );
  } catch {
    throw new Error("ไม่พบ GISP_UAT_PASSWORD ใน Backend ปัจจุบัน กรุณาตั้งค่า UAT Secret ก่อนรันทดสอบ");
  }

  const value = JSON.parse(output)?.value;
  if (!value) throw new Error("GISP_UAT_PASSWORD ไม่มีค่า");
  return value;
}

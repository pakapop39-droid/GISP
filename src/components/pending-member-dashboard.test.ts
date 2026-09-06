import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { AppAccessContext } from "../lib/auth/types";
import { accessHome } from "../lib/auth/policy";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
import { PendingMemberDashboard } from "./pending-member-dashboard";
import { MemberApplicationFiles } from "./member-application-files";

beforeAll(() => { vi.stubGlobal("React", React); });
const context: AppAccessContext = {
  userId: "member", sessionId: "session", sessionExpiresAt: "2026-10-01",
  userStatus: "PENDING", statusReason: null, applicationStatus: "PENDING", applicationReason: null,
  memberProfileId: "profile", organizationId: "org", displayName: "ผู้สมัคร", companyName: "บริษัททดสอบ",
  roles: ["MEMBER"], permissions: [],
};

describe("Pending member dashboard", () => {
  it("shows submission success and only application navigation", () => {
    const html = renderToStaticMarkup(React.createElement(PendingMemberDashboard, { context }));
    expect(html).toContain("ส่งคำขอสำเร็จแล้ว — อยู่ระหว่างรอการอนุมัติ");
    for (const anchor of ["application-status", "company-profile", "application-documents"]) expect(html).toContain(`href="#${anchor}"`);
    expect(html).toContain("ตรวจสอบสถานะล่าสุด");
    expect(html).toContain("ออกจากระบบ");
    expect(html).not.toMatch(/href="\/member\/(catalog|projects|orders|reports)/);
    expect(html).not.toContain("<input");
  });
  it("distinguishes an application under review", () => {
    const html = renderToStaticMarkup(React.createElement(PendingMemberDashboard, { context: { ...context, applicationStatus: "UNDER_REVIEW" } }));
    expect(html).toContain("ทีมกำลังตรวจสอบคำขอ");
  });
  it("keeps approval, rejection, suspension and staff destinations", () => {
    expect(accessHome(context)).toBe("/pending-approval");
    expect(accessHome({ ...context, applicationStatus: "UNDER_REVIEW" })).toBe("/pending-approval");
    expect(accessHome({ ...context, userStatus: "ACTIVE", applicationStatus: "APPROVED" })).toBe("/member/dashboard");
    expect(accessHome({ ...context, applicationStatus: "REJECTED" })).toBe("/application-rejected");
    expect(accessHome({ ...context, userStatus: "SUSPENDED" })).toBe("/account-suspended");
    expect(accessHome({ ...context, userStatus: "ACTIVE", roles: ["SUPER_ADMIN"] })).toBe("/admin/dashboard");
  });
  it("asks for evidence without falsely declaring document completeness", () => {
    const empty = renderToStaticMarkup(React.createElement(MemberApplicationFiles, { initialFiles: [], pendingSummary: true }));
    expect(empty).toContain("ยังไม่มีเอกสาร กรุณาแนบ");
    const file = { id: "file", original_name: "company.pdf", mime_type: "application/pdf", size_bytes: 42, visibility: "MEMBER_PRIVATE" as const, created_at: "2026-09-05T00:00:00Z" };
    const uploaded = renderToStaticMarkup(React.createElement(MemberApplicationFiles, { initialFiles: [file], pendingSummary: true }));
    expect(uploaded).toContain("อัปโหลดแล้ว 1 ไฟล์ — รอทีมตรวจสอบ");
    expect(uploaded).not.toContain("เอกสารครบ");
    expect(uploaded).toContain("/api/files/file/download?redirect=1");
    const regular = renderToStaticMarkup(React.createElement(MemberApplicationFiles, { initialFiles: [file] }));
    expect(regular).not.toContain("รอทีมตรวจสอบ");
  });
});

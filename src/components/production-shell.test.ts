import { createElement, type AnchorHTMLAttributes, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AppAccessContext } from "@/lib/auth/types";

vi.mock("@/lib/auth/staff-job-groups", () => ({
  staffJobGroupLabelsForRoles: () => ["ผู้ดูแลระบบ"],
}));

vi.mock("@/lib/release-stage", () => ({
  isReleaseStagePathAllowed: (pathname: string, stage: string, _staffOperations: boolean, releaseDSlices: readonly number[]) => {
    if (stage !== "D") return true;
    if (pathname === "/admin/claims") return releaseDSlices.includes(9);
    if (pathname === "/admin/reports" || pathname === "/admin/executive") return releaseDSlices.includes(10);
    return true;
  },
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/orders/order-1",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode }) =>
    createElement("a", props, children),
}));

import { ProductionShell } from "./production-shell";

const context: AppAccessContext = {
  userId: "user-1",
  sessionId: "session-1",
  sessionExpiresAt: "2026-09-20T00:00:00.000Z",
  userStatus: "ACTIVE",
  statusReason: null,
  applicationStatus: "APPROVED",
  applicationReason: null,
  memberProfileId: null,
  organizationId: "organization-1",
  displayName: "UAT Admin",
  companyName: "GISP",
  roles: ["SUPER_ADMIN"],
  permissions: ["orders.manage", "claims.manage", "reports.fixed.read", "reports.executive.read"],
};

function renderShell(releaseDSlices: readonly number[]) {
  const props: Parameters<typeof ProductionShell>[0] = {
    portal: "admin",
    context,
    releaseStage: "D",
    releaseDSlices,
    children: createElement("div", null, "Order detail"),
  };
  return renderToStaticMarkup(createElement(ProductionShell, props));
}

describe("ProductionShell Release D navigation", () => {
  it("uses the server-provided release slice snapshot when browser environment values differ", () => {
    const previous = process.env.RELEASE_D_ENABLED_SLICES;
    process.env.RELEASE_D_ENABLED_SLICES = "7,8";
    try {
      const serverAuthorizedMarkup = renderShell([7, 8, 9, 10]);
      expect(serverAuthorizedMarkup).toContain("Claim Queue");
      expect(serverAuthorizedMarkup).toContain("Fixed Reports");
      expect(serverAuthorizedMarkup).toContain("Executive Summary");

      const earlierStageMarkup = renderShell([7, 8]);
      expect(earlierStageMarkup).not.toContain("Claim Queue");
      expect(earlierStageMarkup).not.toContain("Fixed Reports");
      expect(earlierStageMarkup).not.toContain("Executive Summary");
    } finally {
      if (previous === undefined) delete process.env.RELEASE_D_ENABLED_SLICES;
      else process.env.RELEASE_D_ENABLED_SLICES = previous;
    }
  });
});

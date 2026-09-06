import { describe, expect, it } from "vitest";
import {
  rolesForStaffJobGroup,
  staffJobGroupLabelsForRoles,
} from "./staff-job-groups";

describe("staff job groups", () => {
  it("expands the operations group to the five technical roles", () => {
    expect(rolesForStaffJobGroup("OPERATIONS")).toEqual([
      "MEMBER_ADMIN",
      "PRODUCT_ADMIN",
      "ORDER_ADMIN",
      "PURCHASING",
      "QC",
    ]);
  });

  it("never expands a staff group to SUPER_ADMIN", () => {
    for (const group of ["OPERATIONS", "FINANCE", "LOGISTICS"] as const) {
      expect(rolesForStaffJobGroup(group)).not.toContain("SUPER_ADMIN");
    }
  });

  it("shows friendly labels instead of technical roles", () => {
    expect(staffJobGroupLabelsForRoles(["FINANCE"])).toEqual(["การเงิน"]);
    expect(staffJobGroupLabelsForRoles(["SUPER_ADMIN"])).toEqual(["เจ้าของระบบ"]);
    expect(staffJobGroupLabelsForRoles(["PRODUCT_ADMIN"])).toEqual(["สิทธิ์เฉพาะ"]);
  });
});

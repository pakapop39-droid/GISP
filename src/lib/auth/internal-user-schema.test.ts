import { describe, expect, it } from "vitest";
import {
  internalUserCreateSchema,
  internalUserJobGroupsSchema,
  internalUserLifecycleSchema,
} from "./internal-user-schema";

const validInput = {
  name: "Operations Staff",
  email: "operations@example.com",
  temporaryPassword: "temporary-password",
  jobGroup: "OPERATIONS",
};

describe("internal user create schema", () => {
  it("accepts one of the three staff job groups", () => {
    expect(internalUserCreateSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects SUPER_ADMIN as a job group", () => {
    expect(internalUserCreateSchema.safeParse({ ...validInput, jobGroup: "SUPER_ADMIN" }).success).toBe(false);
  });

  it("rejects a tampered raw roles payload", () => {
    expect(internalUserCreateSchema.safeParse({ ...validInput, roles: ["SUPER_ADMIN"] }).success).toBe(false);
  });

  it("accepts multiple job groups and normalizes legacy requests", () => {
    const identity = { name: validInput.name, email: validInput.email, temporaryPassword: validInput.temporaryPassword };
    expect(internalUserCreateSchema.parse({ ...identity, jobGroups: ["OPERATIONS", "LOGISTICS"] }).jobGroups).toEqual(["OPERATIONS", "LOGISTICS"]);
    expect(internalUserCreateSchema.parse(validInput).jobGroups).toEqual(["OPERATIONS"]);
  });

  it("rejects empty groups and owner privileges in a group list", () => {
    const identity = { name: validInput.name, email: validInput.email, temporaryPassword: validInput.temporaryPassword };
    expect(internalUserCreateSchema.safeParse({ ...identity, jobGroups: [] }).success).toBe(false);
    expect(internalUserCreateSchema.safeParse({ ...identity, jobGroups: ["FINANCE", "SUPER_ADMIN"] }).success).toBe(false);
  });
});

describe("internal user management schemas", () => {
  it("accepts only the three job groups and rejects raw roles", () => {
    expect(internalUserJobGroupsSchema.parse({ jobGroups: ["FINANCE", "FINANCE"] })).toEqual({ jobGroups: ["FINANCE"] });
    expect(internalUserJobGroupsSchema.safeParse({ jobGroups: [] }).success).toBe(false);
    expect(internalUserJobGroupsSchema.safeParse({ jobGroups: ["SUPER_ADMIN"] }).success).toBe(false);
    expect(internalUserJobGroupsSchema.safeParse({ jobGroups: ["FINANCE"], roles: ["SUPER_ADMIN"] }).success).toBe(false);
  });

  it("requires explicit confirmation and reasons for risky lifecycle actions", () => {
    expect(internalUserLifecycleSchema.safeParse({ action: "suspend", reason: "ตรวจสอบบัญชี", confirmed: true }).success).toBe(true);
    expect(internalUserLifecycleSchema.safeParse({ action: "suspend", reason: "", confirmed: true }).success).toBe(false);
    expect(internalUserLifecycleSchema.safeParse({ action: "reactivate" }).success).toBe(false);
    expect(internalUserLifecycleSchema.safeParse({ action: "deactivate", reason: "พ้นสภาพ", confirmationEmail: "staff@example.com", confirmed: true }).success).toBe(true);
  });
});


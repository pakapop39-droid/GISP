import { describe, expect, it } from "vitest";
import { internalUserCreateSchema } from "./internal-user-schema";

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


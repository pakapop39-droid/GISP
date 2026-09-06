import { describe, expect, it } from "vitest";
import { isExistingAuthUserError } from "./auth-errors";

describe("isExistingAuthUserError", () => {
  it.each([
    "User already exists",
    "Email is already registered",
    "duplicate key value violates unique constraint \"_user_email_key\"",
  ])("recognizes an existing account error: %s", (message) => {
    expect(isExistingAuthUserError(message)).toBe(true);
  });

  it("does not hide unrelated server errors", () => {
    expect(isExistingAuthUserError("connection timeout")).toBe(false);
  });
});

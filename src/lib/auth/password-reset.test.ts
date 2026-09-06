import { describe, expect, it, vi } from "vitest";
import { requestPasswordResetEmail } from "./password-reset";

const payload = {
  email: "member@example.com",
  redirectTo: "https://app.example.com/reset-password",
};

describe("password reset email request", () => {
  it("records success only when the email provider accepts the request", async () => {
    const send = vi.fn().mockResolvedValue({ data: {}, error: null });

    await expect(requestPasswordResetEmail(send, payload)).resolves.toBe("SUCCESS");
    expect(send).toHaveBeenCalledWith(payload);
  });

  it("records failure when the email provider returns an error", async () => {
    const send = vi.fn().mockResolvedValue({ data: null, error: new Error("redirect denied") });

    await expect(requestPasswordResetEmail(send, payload)).resolves.toBe("FAILED");
  });

  it("records failure when the email provider throws", async () => {
    const send = vi.fn().mockRejectedValue(new Error("provider unavailable"));

    await expect(requestPasswordResetEmail(send, payload)).resolves.toBe("FAILED");
  });
});

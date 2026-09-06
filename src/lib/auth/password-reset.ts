export type PasswordResetEmailPayload = {
  email: string;
  redirectTo: string;
};

export type PasswordResetRequestOutcome = "SUCCESS" | "FAILED";

type ResetEmailResult = {
  error?: unknown;
};

export async function requestPasswordResetEmail(
  send: (payload: PasswordResetEmailPayload) => Promise<ResetEmailResult>,
  payload: PasswordResetEmailPayload,
): Promise<PasswordResetRequestOutcome> {
  try {
    const result = await send(payload);
    return result.error ? "FAILED" : "SUCCESS";
  } catch {
    return "FAILED";
  }
}

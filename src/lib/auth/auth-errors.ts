export function isExistingAuthUserError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("user already exists")
    || normalized.includes("already registered")
    || normalized.includes("duplicate key value violates unique constraint \"_user_email_key\"");
}

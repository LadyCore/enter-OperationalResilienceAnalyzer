/**
 * True when a session user's email address has been confirmed. This is the
 * single authoritative check the route guard uses: an account whose email is
 * not confirmed must NEVER unlock ORA, regardless of how the session arrived.
 */
export function isEmailVerified(user: {
  email_confirmed_at?: string | null;
} | null | undefined): boolean {
  return Boolean(user && user.email_confirmed_at);
}

/**
 * True when an auth-provider error reports an invalid or unsupported email
 * format. This classifies the EXISTING validation result (the provider's
 * rejection at submit time) so the forms can show a clear field-level message
 * without introducing a second, independent email-validation logic.
 */
export function isEmailFormatError(message?: string | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  if (!m.includes("email")) return false;
  return /invalid|not valid|format|validate/.test(m);
}

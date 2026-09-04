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

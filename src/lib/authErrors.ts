type TFunc = (key: string, opts?: Record<string, unknown>) => string;

/**
 * Map known authentication-provider error messages to localized copy. Provider
 * messages arrive in English regardless of the UI language; unknown messages
 * fall back to the original text so no error is ever swallowed.
 */
const PATTERNS: Array<{ re: RegExp; key: string }> = [
  { re: /invalid login credentials|invalid email or password|invalid_credentials/i, key: "auth.error.invalidCredentials" },
  { re: /user already registered|already been registered/i, key: "auth.error.userAlreadyRegistered" },
  { re: /email.*not.*confirmed|not confirmed|confirm your email|email not verified/i, key: "auth.error.emailNotConfirmed" },
  { re: /token has expired|expired or invalid|token.*is invalid/i, key: "auth.error.tokenExpired" },
  { re: /rate limit|too many requests|for security purposes.*only request/i, key: "auth.error.rateLimited" },
  { re: /password should be different|new password.*must.*different/i, key: "auth.error.samePassword" },
  { re: /at least 6 characters|password.*too short|weak password/i, key: "auth.error.passwordTooShort" },
];

export function localizeAuthError(message: string, t: TFunc): string {
  for (const p of PATTERNS) {
    if (p.re.test(message)) return t(p.key);
  }
  return message;
}

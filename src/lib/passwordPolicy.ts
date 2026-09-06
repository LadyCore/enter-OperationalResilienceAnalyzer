/**
 * ORA password policy — enforced everywhere a password is created or changed
 * (signup, password recovery, and in-app password change).
 *
 * Rules:
 *  - at least 8 characters (no artificial upper limit)
 *  - at least one uppercase letter
 *  - at least one number
 *  - at least one special character
 *  - no spaces
 */

export const PASSWORD_POLICY_HINT =
  "At least 8 characters with at least one uppercase letter, one number and one special character. No spaces.";

export const PASSWORD_PLACEHOLDER = "At least 8 characters";

export const PASSWORD_EXAMPLE = "e.g. Ora8#x2k";

export const PASSWORD_ERROR_KEYS = {
  empty: "passwordPolicy.empty",
  length: "passwordPolicy.length",
  spaces: "passwordPolicy.spaces",
  letter: "passwordPolicy.letter",
  uppercase: "passwordPolicy.uppercase",
  number: "passwordPolicy.number",
  special: "passwordPolicy.special",
} as const;

/**
 * Returns the i18n key of the first violated rule, or null for a valid
 * password. Callers translate the key at display time (t(key)) so messages
 * follow the app language.
 */
export function validatePassword(password: string): string | null {
  if (password.length === 0) return PASSWORD_ERROR_KEYS.empty;
  if (password.length < 8) return PASSWORD_ERROR_KEYS.length;
  if (/\s/.test(password)) return PASSWORD_ERROR_KEYS.spaces;
  if (!/[A-Za-z]/.test(password)) return PASSWORD_ERROR_KEYS.letter;
  if (!/[A-Z]/.test(password)) return PASSWORD_ERROR_KEYS.uppercase;
  if (!/[0-9]/.test(password)) return PASSWORD_ERROR_KEYS.number;
  if (!/[^A-Za-z0-9]/.test(password)) return PASSWORD_ERROR_KEYS.special;
  return null;
}

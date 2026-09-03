/**
 * ORA password policy — enforced everywhere a password is created or changed
 * (signup, password recovery, and in-app password change).
 *
 * Rules:
 *  - exactly 8 characters
 *  - at least one letter
 *  - at least one number
 *  - at least one special character
 *  - no spaces
 */

export const PASSWORD_POLICY_HINT =
  "Exactly 8 characters with at least one letter, one number and one special character. No spaces.";

export const PASSWORD_PLACEHOLDER = "Exactly 8 characters";

export const PASSWORD_EXAMPLE = "e.g. Ora8#x2k";

/** Returns an error message when the password violates the policy, else null. */
export function validatePassword(password: string): string | null {
  if (password.length === 0) return "Enter a password.";
  if (password.length !== 8) return "Password must be exactly 8 characters.";
  if (/\s/.test(password)) return "Password must not contain spaces.";
  if (!/[A-Za-z]/.test(password)) return "Password must contain at least one letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least one special character.";
  return null;
}

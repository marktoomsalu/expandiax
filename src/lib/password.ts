// The rule for new passwords (sign-up and reset) — sign-in doesn't check
// it, so accounts made under the older 8-character rule still get in.
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number.`;

/** What's wrong with a new password, or null when it's fine. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Choose a password with at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return "Use at least one letter and one number in your password.";
  return null;
}

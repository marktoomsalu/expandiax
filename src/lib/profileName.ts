// "Traveller" is what a profile is called until its owner gives a name -
// the database uses it when sign-up didn't bring one (see migration 057).
export const PLACEHOLDER_NAME = "Traveller";

/** Whether someone has given a name of their own, rather than the placeholder. */
export const hasRealName = (name: string | null | undefined): name is string => !!name?.trim() && name.trim() !== PLACEHOLDER_NAME;

/** "Ingeli Tamm" from Apple's given and family name (Apple sends them only on the first sign-in). */
export function nameFromParts(given: string | null | undefined, family: string | null | undefined): string | null {
  const name = [given, family].map((s) => s?.trim()).filter(Boolean).join(" ");
  return name ? name.slice(0, 80) : null;
}

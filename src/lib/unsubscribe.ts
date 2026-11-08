import { createHmac, timingSafeEqual } from "node:crypto";

// Signed links that turn off one kind of email for one person without a
// login — what a "one-click unsubscribe" needs. Signed with a server secret
// so nobody can unsubscribe someone else by guessing an id.

/** The emails someone can switch off, and the profile column behind each. */
export const EMAIL_LISTS = {
  digest: { column: "weekly_digest_enabled", name: "the weekly digest" },
  follows: { column: "follow_email_enabled", name: "emails about new followers" },
} as const;
export type EmailList = keyof typeof EMAIL_LISTS;

export const isEmailList = (v: string | null): v is EmailList => v !== null && Object.hasOwn(EMAIL_LISTS, v);

function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET ?? process.env.CRON_SECRET;
  if (!s) throw new Error("not_configured");
  return s;
}

// The digest keeps its original message, so links in digests already sent still work.
const message = (userId: string, list: EmailList) => (list === "digest" ? `weekly-digest:${userId}` : `${list}:${userId}`);

export function unsubscribeToken(userId: string, list: EmailList = "digest"): string {
  return createHmac("sha256", secret()).update(message(userId, list)).digest("hex");
}

export function verifyUnsubscribeToken(userId: string, token: string, list: EmailList = "digest"): boolean {
  try {
    const expected = Buffer.from(unsubscribeToken(userId, list), "hex");
    const given = Buffer.from(token, "hex");
    return expected.length === given.length && timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}

export function unsubscribeUrl(userId: string, list: EmailList = "digest", origin = "https://expandiax.com"): string {
  const l = list === "digest" ? "" : `&l=${list}`;
  return `${origin}/api/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId, list)}${l}`;
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

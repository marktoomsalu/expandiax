import { createHmac, timingSafeEqual } from "node:crypto";

// A signed link that turns off one person's weekly digest without a login —
// what a "one-click unsubscribe" needs. Signed with a server secret so nobody
// can unsubscribe someone else by guessing an id.
function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET ?? process.env.CRON_SECRET;
  if (!s) throw new Error("not_configured");
  return s;
}

export function unsubscribeToken(userId: string): string {
  return createHmac("sha256", secret()).update(`weekly-digest:${userId}`).digest("hex");
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  try {
    const expected = Buffer.from(unsubscribeToken(userId), "hex");
    const given = Buffer.from(token, "hex");
    return expected.length === given.length && timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}

export function unsubscribeUrl(userId: string, origin = "https://expandiax.com"): string {
  return `${origin}/api/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

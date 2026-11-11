// Invite links (migration 071): expandiax.com/join/<username>. Opening one
// remembers who invited you (a cookie for 30 days, on this device); right
// after signing up, /onboarding claims it, and you and your friend follow
// each other. Friends who join count for the Friends badges (5, 10, 25).

export const INVITE_COOKIE = "xinvite";

export const inviteUrl = (username: string) => `https://expandiax.com/join/${encodeURIComponent(username)}`;

/** What the share sheet writes next to the link (the link's own preview says the rest). */
export const INVITE_TEXT = "Join me on ExpandiaX 🌍";

/** On this device: who invited you (from the cookie the join page set). */
export function readInvite(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${INVITE_COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function rememberInvite(username: string) {
  document.cookie = `${INVITE_COOKIE}=${encodeURIComponent(username)}; max-age=${30 * 86400}; path=/; samesite=lax; secure`;
}

export function forgetInvite() {
  document.cookie = `${INVITE_COOKIE}=; max-age=0; path=/; samesite=lax; secure`;
}

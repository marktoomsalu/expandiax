// Invite links (migration 071): expandiax.com/join/<username>. Opening one
// remembers who invited you (a cookie for 30 days, on this device); right
// after signing up, /onboarding claims it, and you and your friend follow
// each other. Friends who join count for the Friends badges (5, 10, 25).

export const INVITE_COOKIE = "xinvite";

export const inviteUrl = (username: string) => `https://expandiax.com/join/${encodeURIComponent(username)}`;

/** What the share sheet writes next to the link (the link's own preview says the rest). */
export const INVITE_TEXT = "Join me on ExpandiaX 🌍";

/**
 * The invitation as a message (WhatsApp first): warm, personal, the link on
 * a line of its own so the preview card shows under it.
 */
export function inviteMessage(url: string, stats?: { countries?: number; events?: number }): string {
  const c = stats?.countries ?? 0;
  const e = stats?.events ?? 0;
  const so_far =
    c >= 2 && e >= 1 ? ` ${c} countries and ${e} ${e === 1 ? "event" : "events"} so far.` : c >= 2 ? ` ${c} countries so far.` : e >= 2 ? ` ${e} events so far.` : "";
  return `Hey! I'm keeping my trips, concerts and other memories on ExpandiaX 🌍${so_far}

Join me and we'll follow each other automatically 👇
${url}`;
}

/** The same, for a trip or event you added them to. */
export function momentMessage(url: string, opts: { name?: string | null; noun: string; title?: string | null }): string {
  const hi = opts.name?.trim() ? `Hey ${opts.name.trim().split(/\s+/)[0]}!` : "Hey!";
  const what = opts.title?.trim() ? `our ${opts.noun}, ${opts.title.trim()},` : `our ${opts.noun}`;
  return `${hi} I added ${what} to ExpandiaX and you were part of it 💛

Open it here and add your own photos 👇
${url}`;
}

/** WhatsApp with the message ready: the app on a phone, WhatsApp Web on a computer. */
export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** On this device: who invited you (from the cookie the join page set). */
export function readInvite(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${INVITE_COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function rememberInvite(username: string) {
  document.cookie = `${INVITE_COOKIE}=${encodeURIComponent(username)}; max-age=${30 * 86400}; path=/; samesite=lax; secure`;
}

/** A link to a trip or event someone added you to (migration 078): which one, until you've signed up. */
export const MOMENT_COOKIE = "xmoment";

export function rememberMoment(token: string) {
  document.cookie = `${MOMENT_COOKIE}=${encodeURIComponent(token)}; max-age=${30 * 86400}; path=/; samesite=lax; secure`;
}

export function forgetInvite() {
  document.cookie = `${INVITE_COOKIE}=; max-age=0; path=/; samesite=lax; secure`;
}

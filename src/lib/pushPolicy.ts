// The rules every push notification goes through before it reaches a phone:
// how important it is, whether it joins one that's already there, quiet
// hours, and how often reminders and announcements may come. Pure logic
// (no database), so it can be tested; /api/push/send, the reminders and
// the announcements apply it. The numbers are editable in /admin/push
// (stored in push_rules, migration 068) and fall back to these.

export type PushRules = {
  /** Quiet hours in the person's own time zone: from this hour… */
  quietStart: number;
  /** …until this hour. */
  quietEnd: number;
  /** During quiet hours, followers, comments and likes arrive without a sound or banner. */
  quietSocialSilent: boolean;
  /** A chat that keeps going buzzes again at most this often (minutes); in between the notification just updates. */
  messageRealertMinutes: number;
  /** An unopened like/comment/follower notification keeps collecting for this long (hours) before a new one may buzz. */
  groupHours: number;
  /** Memory reminders at all. */
  remindersOn: boolean;
  /** At most one memory reminder in this many days. */
  reminderEveryDays: number;
  /** Only for people who haven't opened ExpandiaX in this many days. */
  reminderInactiveDays: number;
  /** No reminder for anyone who got this many social notifications in the last 7 days. */
  reminderSkipSocial: number;
  /** Reminders go out from this hour (their own time), and never in quiet hours. */
  reminderHour: number;
  /** Reminders and announcements together: at most this many a day. */
  lowPerDay: number;
};

export const DEFAULT_RULES: PushRules = {
  quietStart: 22,
  quietEnd: 8,
  quietSocialSilent: true,
  messageRealertMinutes: 10,
  groupHours: 24,
  remindersOn: true,
  reminderEveryDays: 7,
  reminderInactiveDays: 3,
  reminderSkipSocial: 3,
  reminderHour: 18,
  lowPerDay: 1,
};

const LIMITS: Record<keyof PushRules, [number, number] | "bool"> = {
  quietStart: [0, 23],
  quietEnd: [0, 23],
  quietSocialSilent: "bool",
  messageRealertMinutes: [1, 240],
  groupHours: [1, 168],
  remindersOn: "bool",
  reminderEveryDays: [1, 60],
  reminderInactiveDays: [1, 60],
  reminderSkipSocial: [1, 100],
  reminderHour: [0, 23],
  lowPerDay: [0, 5],
};

/** The defaults, with whatever valid values were saved on top. */
export function mergeRules(saved: unknown): PushRules {
  const out = { ...DEFAULT_RULES } as Record<keyof PushRules, number | boolean>;
  if (!saved || typeof saved !== "object") return out as PushRules;
  for (const [k, limit] of Object.entries(LIMITS) as [keyof PushRules, (typeof LIMITS)[keyof PushRules]][]) {
    const v = (saved as Record<string, unknown>)[k];
    if (limit === "bool") {
      if (typeof v === "boolean") out[k] = v;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = Math.min(limit[1], Math.max(limit[0], Math.round(v)));
    }
  }
  return out as PushRules;
}

// ---------- Priority ----------

/** 1 = most important. Messages, then followers, comments, likes, memory reminders, announcements. */
export const PRIORITY: Record<string, 1 | 2 | 3 | 4 | 5 | 6> = {
  message: 1,
  postcard: 1,
  follow: 2,
  follow_request: 2,
  follow_accepted: 2,
  invite_joined: 2,
  comment: 3,
  question: 3,
  answer: 3,
  like: 4,
  reminder: 5,
  campaign: 6,
};

/** Social notifications: everything people do to or with you. */
export const isSocial = (kind: string) => (PRIORITY[kind] ?? 9) <= 4;

/**
 * Which notifications collect into one: all likes on one memory, all
 * comments on it, everyone who followed you, every message in a chat.
 */
export function groupKey(kind: string, targetKind: string | null, targetId: string | null, actorId: string): string {
  switch (kind) {
    case "message":
    case "postcard":
      return `chat:${targetId}`;
    case "like":
      return `like:${targetKind}:${targetId}`;
    case "comment":
      return `comment:${targetKind}:${targetId}`;
    case "question":
    case "answer":
      return `${kind}:${targetId}`;
    case "follow":
    case "follow_request":
      return kind;
    default:
      return `${kind}:${actorId}`;
  }
}

// ---------- Time ----------

/** The hour (0-23) it is now where they are. Unknown or broken zones count as Tallinn. */
export function localHour(timeZone: string | null | undefined, now: Date): number {
  const hour = (tz: string) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(now));
  try {
    return hour(timeZone || "Europe/Tallinn");
  } catch {
    return hour("Europe/Tallinn");
  }
}

/** Whether it's night for them (quiet hours may run past midnight, 22 → 8). */
export function inQuietHours(rules: Pick<PushRules, "quietStart" | "quietEnd">, timeZone: string | null | undefined, now: Date): boolean {
  const h = localHour(timeZone, now);
  const { quietStart: s, quietEnd: e } = rules;
  if (s === e) return false;
  return s < e ? h >= s && h < e : h >= s || h < e;
}

// ---------- Social notifications ----------

/** The last notification in this group that did buzz, and whether they've seen it since. */
export type GroupState = { lastAlertAt: Date; seen: boolean } | null;

export type SocialDecision =
  /** A new notification (silent = no sound or banner: quiet hours). */
  | { action: "alert"; silent: boolean }
  /** Replace the one on their phone with the new count, without a sound. */
  | { action: "update" }
  | { action: "skip"; reason: "viewing" };

/**
 * One like, follower, comment or message:
 *  - they're looking at it right now → nothing;
 *  - the notification about it is still unopened (and recent) → it's
 *    updated in place ("Alex and 4 others…") instead of buzzing again;
 *    a chat that keeps going may buzz again after a few minutes;
 *  - otherwise a new notification, silent in quiet hours for anything
 *    but messages.
 */
export function decideSocial(input: { kind: string; rules: PushRules; group: GroupState; viewing: boolean; quiet: boolean; now: Date }): SocialDecision {
  const { kind, rules, group, viewing, quiet, now } = input;
  if (viewing) return { action: "skip", reason: "viewing" };
  const priority = PRIORITY[kind] ?? 4;
  if (group && !group.seen) {
    const minutes = (now.getTime() - group.lastAlertAt.getTime()) / 60_000;
    const stillCollecting = priority === 1 ? minutes < rules.messageRealertMinutes : minutes < rules.groupHours * 60;
    if (stillCollecting) return { action: "update" };
  }
  return { action: "alert", silent: quiet && priority > 1 && rules.quietSocialSilent };
}

/** "1 other", "4 others". */
export const others = (n: number) => `${n} ${n === 1 ? "other" : "others"}`;

// ---------- Reminders and announcements ----------

export type ReminderCheck = {
  /** Last time they used the app (any signal), or null. */
  lastActiveAt: Date | null;
  lastReminderAt: Date | null;
  /** Social notifications that reached them in the last 7 days. */
  socialLastWeek: number;
  /** Reminders and announcements in the last day. */
  lowLastDay: number;
  timeZone: string | null;
};

export type ReminderVerdict = { send: true } | { send: false; reason: "off" | "active" | "recent" | "social" | "daily_limit" | "quiet" | "too_early" };

/** Whether a memory reminder is due for someone now. */
export function reminderDue(rules: PushRules, c: ReminderCheck, now: Date): ReminderVerdict {
  const daysSince = (d: Date | null) => (d ? (now.getTime() - d.getTime()) / 86_400_000 : Infinity);
  if (!rules.remindersOn) return { send: false, reason: "off" };
  if (daysSince(c.lastActiveAt) < rules.reminderInactiveDays) return { send: false, reason: "active" };
  if (daysSince(c.lastReminderAt) < rules.reminderEveryDays) return { send: false, reason: "recent" };
  if (c.socialLastWeek >= rules.reminderSkipSocial) return { send: false, reason: "social" };
  if (c.lowLastDay >= rules.lowPerDay) return { send: false, reason: "daily_limit" };
  if (inQuietHours(rules, c.timeZone, now)) return { send: false, reason: "quiet" };
  const h = localHour(c.timeZone, now);
  // From reminderHour until quiet hours start (or midnight).
  const end = rules.quietStart > rules.reminderHour ? rules.quietStart : 24;
  if (h < rules.reminderHour || h >= end) return { send: false, reason: "too_early" };
  return { send: true };
}

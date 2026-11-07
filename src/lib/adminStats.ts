// The founder's dashboard numbers, worked out from plain rows. Everything
// returned is a count or a share — no one is named — and "came back"
// only counts members who joined after active days started being recorded.

export type Member = { id: string; joined: string }; // joined: yyyy-mm-dd (UTC)
export type ActiveDay = { user_id: string; day: string }; // yyyy-mm-dd

const DAY = 86_400_000;
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** One entry per day for the last `days` days up to `today`, counting the dates that fall on each. */
export function perDay(dates: string[], days: number, today: string): { day: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const d of dates) counts.set(d, (counts.get(d) ?? 0) + 1);
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - days + 1);
    return { day, n: counts.get(day) ?? 0 };
  });
}

/** Distinct members active today, in the last 7 days, and in the last 30 days. */
export function activeCounts(activity: ActiveDay[], today: string): { day: number; week: number; month: number } {
  const since = (n: number) => {
    const from = addDays(today, -(n - 1));
    return new Set(activity.filter((a) => a.day >= from && a.day <= today).map((a) => a.user_id)).size;
  };
  return { day: since(1), week: since(7), month: since(30) };
}

/** Distinct active members per day for the last `days` days. */
export function activePerDay(activity: ActiveDay[], days: number, today: string): { day: string; n: number }[] {
  const byDay = new Map<string, Set<string>>();
  for (const a of activity) (byDay.get(a.day) ?? byDay.set(a.day, new Set()).get(a.day)!).add(a.user_id);
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - days + 1);
    return { day, n: byDay.get(day)?.size ?? 0 };
  });
}

/**
 * Of the members who joined at least `n` days ago (and after recording
 * began), how many came back on day `n` or later.
 */
export function cameBack(members: Member[], activity: ActiveDay[], n: number, today: string, trackingSince: string | null): { eligible: number; returned: number } {
  if (!trackingSince) return { eligible: 0, returned: 0 };
  const lastDay = new Map<string, string>();
  for (const a of activity) if ((lastDay.get(a.user_id) ?? "") < a.day) lastDay.set(a.user_id, a.day);
  const eligible = members.filter((m) => m.joined >= trackingSince && m.joined <= addDays(today, -n));
  const returned = eligible.filter((m) => (lastDay.get(m.id) ?? "") >= addDays(m.joined, n));
  return { eligible: eligible.length, returned: returned.length };
}

/** "34%" — or "–" when there's nothing to divide by yet. */
export function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–";
}

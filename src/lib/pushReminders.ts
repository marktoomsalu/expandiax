import type { SupabaseClient } from "@supabase/supabase-js";
import type { OwnCountryLite, OwnEventLite } from "./feedSections";
import { pickReminder, reminderLink } from "./memoryReminder";
import { PRIORITY, reminderDue } from "./pushPolicy";
import { loadRules, logPush, sendToDevices, textsFor, type Device } from "./pushDelivery";
import { fillTemplate } from "./pushTexts";

// Memory reminders (P5): about once a week, only for people who haven't
// been in ExpandiaX lately and haven't had much social news, in their
// evening, never in quiet hours, and only when there's a memory worth
// bringing back (lib/memoryReminder). Each opens the feed's "One to
// remember" showing it. Runs with the five-minute job, every half hour.

const MAX_PER_RUN = 100;

export async function sendDueReminders(admin: SupabaseClient, now = new Date()) {
  const rules = await loadRules(admin);
  if (!rules.remindersOn) return 0;
  const windowDays = Math.max(rules.reminderEveryDays, 7);
  const since = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

  const [{ data: people }, tokenRes, logRes, { data: days }, presenceRes] = await Promise.all([
    admin.from("profiles").select("id").eq("push_reminders", true).limit(100000),
    admin.from("device_tokens").select("user_id, token, platform, timezone").order("updated_at", { ascending: false }).limit(100000),
    admin.from("push_log").select("user_id, kind, priority, outcome, target, created_at").gte("created_at", since(windowDays)).in("outcome", ["sent", "silent", "updated"]).limit(200000),
    admin.from("activity_days").select("user_id, day").gte("day", since(rules.reminderInactiveDays + 1).slice(0, 10)).limit(200000),
    admin.from("push_presence").select("user_id, seen_at").gte("seen_at", since(rules.reminderInactiveDays)).limit(100000),
  ]);
  // Needs migration 068 (time zones, the log).
  if (tokenRes.error || logRes.error) return 0;

  const devices = new Map<string, Device[]>();
  for (const t of (tokenRes.data ?? []) as (Device & { user_id: string })[]) devices.set(t.user_id, [...(devices.get(t.user_id) ?? []), t]);

  const lastActive = new Map<string, number>();
  const seenAt = (id: string, t: number) => lastActive.set(id, Math.max(lastActive.get(id) ?? 0, t));
  // A day counts until its end.
  for (const d of days ?? []) seenAt(d.user_id as string, Date.parse(`${d.day}T23:59:59Z`));
  for (const p of presenceRes.data ?? []) seenAt(p.user_id as string, Date.parse(p.seen_at as string));

  type Log = { user_id: string; kind: string; priority: number; outcome: string; target: string | null; created_at: string };
  const logs = new Map<string, Log[]>();
  for (const l of (logRes.data ?? []) as Log[]) logs.set(l.user_id, [...(logs.get(l.user_id) ?? []), l]);

  const due: { id: string; lastTarget: string | null }[] = [];
  for (const p of people ?? []) {
    const id = p.id as string;
    const ds = devices.get(id);
    if (!ds?.length) continue;
    const mine = logs.get(id) ?? [];
    const reminders = mine.filter((l) => l.kind === "reminder").sort((a, b) => b.created_at.localeCompare(a.created_at));
    const weekAgo = now.getTime() - 7 * 86_400_000;
    const dayAgo = now.getTime() - 20 * 3_600_000;
    const verdict = reminderDue(
      rules,
      {
        lastActiveAt: lastActive.has(id) ? new Date(lastActive.get(id)!) : null,
        lastReminderAt: reminders[0] ? new Date(reminders[0].created_at) : null,
        socialLastWeek: mine.filter((l) => l.priority <= 4 && Date.parse(l.created_at) >= weekAgo).length,
        lowLastDay: mine.filter((l) => l.priority >= 5 && l.outcome !== "updated" && Date.parse(l.created_at) >= dayAgo).length,
        timeZone: ds[0].timezone,
      },
      now
    );
    if (verdict.send) due.push({ id, lastTarget: reminders[0]?.target ?? null });
    if (due.length >= MAX_PER_RUN) break;
  }
  if (!due.length) return 0;

  const texts = await textsFor(admin, ["reminder_anniversary", "reminder_photos", "reminder_memory"]);
  let sent = 0;
  for (const person of due) {
    const [{ data: ev }, { data: co }] = await Promise.all([
      admin.from("events").select("id, title, event_date, cover_media_id, is_favourite, event_media!event_media_event_id_fkey(count)").eq("user_id", person.id),
      admin
        .from("visited_countries")
        .select("id, country_code, country_name, cover_media_id, is_favourite, country_media!country_media_visited_country_id_fkey(count), country_visits(year, visited_from, visited_to, date_precision)")
        .eq("user_id", person.id),
    ]);
    const events: OwnEventLite[] = (ev ?? []).map(({ event_media, ...e }) => ({ ...(e as Omit<OwnEventLite, "media_count">), media_count: (event_media as unknown as { count: number }[])[0]?.count ?? 0 }));
    const countries: OwnCountryLite[] = (co ?? []).map(({ country_media, ...c }) => ({ ...(c as unknown as Omit<OwnCountryLite, "media_count">), media_count: (country_media as unknown as { count: number }[])[0]?.count ?? 0 }));
    const pick = pickReminder(events, countries, person.id, now, person.lastTarget);
    const words = pick ? texts[`reminder_${pick.kind}`] : null;
    if (!pick || !words) continue;

    const title = fillTemplate(words.title, pick.values);
    const body = fillTemplate(words.body, pick.values);
    // Sentence case for a title that starts with a placeholder ("3 years ago today").
    const niceTitle = title.charAt(0).toUpperCase() + title.slice(1);
    const link = reminderLink(pick.target);
    const logId = await logPush(admin, { user_id: person.id, kind: "reminder", priority: PRIORITY.reminder, target: pick.target, outcome: "sent", title: niceTitle, body });
    const r = await sendToDevices(admin, devices.get(person.id)!, { title: niceTitle, body, group: "reminder", mode: "alert", data: { kind: "reminder", link, ...(logId ? { logId } : {}) } });
    if (!r.delivered && logId) await admin.from("push_log").update({ outcome: "skipped", reason: "not_delivered" }).eq("id", logId);
    sent += r.delivered ? 1 : 0;
  }
  return sent;
}

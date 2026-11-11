import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, decideSocial, groupKey, inQuietHours, mergeRules, others, reminderDue, type ReminderCheck } from "./pushPolicy";

const at = (iso: string) => new Date(iso);
// 12:00 in Tallinn (UTC+2 in November).
const noon = at("2026-11-11T10:00:00Z");

describe("mergeRules", () => {
  it("keeps defaults and clamps saved values", () => {
    expect(mergeRules(null)).toEqual(DEFAULT_RULES);
    const r = mergeRules({ quietStart: 30, groupHours: 0, remindersOn: false, lowPerDay: "2", bogus: 1 });
    expect(r.quietStart).toBe(23);
    expect(r.groupHours).toBe(1);
    expect(r.remindersOn).toBe(false);
    expect(r.lowPerDay).toBe(DEFAULT_RULES.lowPerDay);
  });
});

describe("groupKey", () => {
  it("groups likes and comments per memory, follows together, messages per chat", () => {
    expect(groupKey("like", "country", "c1", "a")).toBe("like:country:c1");
    expect(groupKey("like", "country", "c1", "b")).toBe("like:country:c1");
    expect(groupKey("comment", "event", "e1", "a")).toBe("comment:event:e1");
    expect(groupKey("follow", null, null, "a")).toBe(groupKey("follow", null, null, "b"));
    expect(groupKey("message", "conversation", "v1", "a")).toBe("chat:v1");
    expect(groupKey("follow_accepted", null, null, "a")).not.toBe(groupKey("follow_accepted", null, null, "b"));
  });
});

describe("quiet hours", () => {
  it("runs past midnight in their own time zone", () => {
    const r = { quietStart: 22, quietEnd: 8 };
    expect(inQuietHours(r, "Europe/Tallinn", at("2026-11-11T21:30:00Z"))).toBe(true); // 23:30
    expect(inQuietHours(r, "Europe/Tallinn", at("2026-11-11T05:30:00Z"))).toBe(true); // 07:30
    expect(inQuietHours(r, "Europe/Tallinn", at("2026-11-11T06:30:00Z"))).toBe(false); // 08:30
    expect(inQuietHours(r, "America/New_York", at("2026-11-11T21:30:00Z"))).toBe(false); // 16:30
    expect(inQuietHours(r, "Not/AZone", at("2026-11-11T21:30:00Z"))).toBe(true); // falls back to Tallinn
  });
});

describe("decideSocial", () => {
  const base = { rules: DEFAULT_RULES, viewing: false, quiet: false, now: noon };
  it("buzzes for the first like", () => {
    expect(decideSocial({ ...base, kind: "like", group: null })).toEqual({ action: "alert", silent: false });
  });
  it("updates instead of buzzing while the first is unopened", () => {
    const group = { lastAlertAt: at("2026-11-11T09:00:00Z"), seen: false };
    expect(decideSocial({ ...base, kind: "like", group })).toEqual({ action: "update" });
  });
  it("buzzes again once they've seen it, or after the group window", () => {
    expect(decideSocial({ ...base, kind: "like", group: { lastAlertAt: at("2026-11-11T09:00:00Z"), seen: true } }).action).toBe("alert");
    expect(decideSocial({ ...base, kind: "like", group: { lastAlertAt: at("2026-11-10T09:00:00Z"), seen: false } }).action).toBe("alert");
  });
  it("lets a busy chat buzz again after a few minutes", () => {
    expect(decideSocial({ ...base, kind: "message", group: { lastAlertAt: at("2026-11-11T09:55:00Z"), seen: false } }).action).toBe("update");
    expect(decideSocial({ ...base, kind: "message", group: { lastAlertAt: at("2026-11-11T09:45:00Z"), seen: false } }).action).toBe("alert");
  });
  it("is silent at night except for messages", () => {
    expect(decideSocial({ ...base, quiet: true, kind: "like", group: null })).toEqual({ action: "alert", silent: true });
    expect(decideSocial({ ...base, quiet: true, kind: "message", group: null })).toEqual({ action: "alert", silent: false });
  });
  it("skips what they're looking at", () => {
    expect(decideSocial({ ...base, viewing: true, kind: "message", group: null })).toEqual({ action: "skip", reason: "viewing" });
  });
  it("says 1 other / 4 others", () => {
    expect(others(1)).toBe("1 other");
    expect(others(4)).toBe("4 others");
  });
});

describe("reminderDue", () => {
  // 19:00 in Tallinn.
  const evening = at("2026-11-11T17:00:00Z");
  const quietPerson: ReminderCheck = { lastActiveAt: at("2026-11-01T10:00:00Z"), lastReminderAt: null, socialLastWeek: 0, lowLastDay: 0, timeZone: "Europe/Tallinn" };
  it("reminds someone who's been away, in their evening", () => {
    expect(reminderDue(DEFAULT_RULES, quietPerson, evening)).toEqual({ send: true });
  });
  it("leaves active people alone", () => {
    expect(reminderDue(DEFAULT_RULES, { ...quietPerson, lastActiveAt: at("2026-11-10T10:00:00Z") }, evening)).toEqual({ send: false, reason: "active" });
    expect(reminderDue(DEFAULT_RULES, { ...quietPerson, socialLastWeek: 3 }, evening)).toEqual({ send: false, reason: "social" });
  });
  it("at most once a week and once a day with announcements", () => {
    expect(reminderDue(DEFAULT_RULES, { ...quietPerson, lastReminderAt: at("2026-11-06T17:00:00Z") }, evening).send).toBe(false);
    expect(reminderDue(DEFAULT_RULES, { ...quietPerson, lastReminderAt: at("2026-11-03T17:00:00Z") }, evening).send).toBe(true);
    expect(reminderDue(DEFAULT_RULES, { ...quietPerson, lowLastDay: 1 }, evening)).toEqual({ send: false, reason: "daily_limit" });
  });
  it("only in the evening, never at night, and not when switched off", () => {
    expect(reminderDue(DEFAULT_RULES, quietPerson, noon)).toEqual({ send: false, reason: "too_early" });
    expect(reminderDue(DEFAULT_RULES, quietPerson, at("2026-11-11T21:00:00Z"))).toEqual({ send: false, reason: "quiet" });
    expect(reminderDue({ ...DEFAULT_RULES, remindersOn: false }, quietPerson, evening)).toEqual({ send: false, reason: "off" });
  });
});

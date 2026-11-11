import { describe, expect, it } from "vitest";
import { pickReminder, reminderLink } from "./memoryReminder";
import type { OwnCountryLite, OwnEventLite } from "./feedSections";

const now = new Date("2026-11-11T17:00:00Z");
const country = (id: string, code: string, name: string, to: string, media: number): OwnCountryLite => ({
  id,
  country_code: code,
  country_name: name,
  cover_media_id: null,
  is_favourite: false,
  media_count: media,
  country_visits: [{ year: Number(to.slice(0, 4)), visited_from: to, visited_to: to, date_precision: "day" }],
});
const event = (id: string, title: string, date: string, media: number): OwnEventLite => ({ id, title, event_date: date, cover_media_id: null, is_favourite: false, media_count: media });

describe("pickReminder", () => {
  it("prefers an anniversary", () => {
    const p = pickReminder([event("e1", "Coldplay", "2023-11-11", 3)], [country("c1", "IT", "Italy", "2024-05-01", 0)], "u", now, null);
    expect(p?.kind).toBe("anniversary");
    expect(p?.target).toBe("event:e1");
    expect(p?.values.ago).toBe("3 years ago");
  });
  it("then a memory still missing photos, not the same one twice", () => {
    const cs = [country("c1", "IT", "Italy", "2024-05-01", 0), country("c2", "FR", "France", "2023-05-01", 0), country("c3", "ES", "Spain", "2022-05-01", 4)];
    const first = pickReminder([], cs, "u", now, null);
    expect(first).toMatchObject({ kind: "photos", target: "country:c1", values: { title: "Italy", flag: "🇮🇹" } });
    expect(pickReminder([], cs, "u", now, "country:c1")?.target).toBe("country:c2");
  });
  it("otherwise the day's One to remember", () => {
    const p = pickReminder([], [country("c3", "ES", "Spain", "2022-05-01", 4)], "u", now, null);
    expect(p).toMatchObject({ kind: "memory", target: "country:c3" });
  });
  it("nothing logged, nothing to remind", () => {
    expect(pickReminder([], [], "u", now, null)).toBeNull();
  });
  it("opens One to remember in the feed", () => {
    expect(reminderLink("country:c1")).toBe("/feed?remember=country%3Ac1#one-to-remember");
  });
});

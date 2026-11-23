import { describe, expect, it } from "vitest";
import { buildWrapped, hasStory, type WrappedEventRow, type WrappedVisit } from "./wrapped";

const v = (code: string, from: string | null, to: string | null, extra: Partial<WrappedVisit> = {}): WrappedVisit => ({
  id: `${code}-${from ?? extra.year}`,
  code,
  year: from ? Number(from.slice(0, 4)) : extra.year ?? 2026,
  from,
  to,
  precision: from ? "day" : "year",
  kind: "trip",
  places: [],
  ...extra,
});
const e = (title: string, date: string, code: string): WrappedEventRow => ({ id: title, title, type: "concert", date, endDate: null, venue: null, city: null, code, photo: null });
const build = (visits: WrappedVisit[], events: WrappedEventRow[] = [], undatedCodes: string[] = []) =>
  buildWrapped({ year: 2026, firstName: "Mark", homeCode: "EE", visits, undatedCodes, events, photos: [] });

describe("buildWrapped", () => {
  it("counts the year's countries in the order they came, trips, places and days away", () => {
    const w = build([
      v("IT", "2026-07-12", "2026-07-19", { places: [{ name: "Rome", lat: 0, lng: 0 }, { name: "Florence", lat: 0, lng: 0 }] }),
      v("FI", "2026-02-01", "2026-02-03"),
      v("EE", "2026-05-01", "2026-05-02"),
      v("ES", "2025-04-01", "2025-04-05"),
    ]);
    expect(w.countries).toEqual(["FI", "EE", "IT"]);
    expect(w.trips).toBe(3);
    expect(w.places).toEqual(["Rome", "Florence"]);
    // Finland 3 days + Italy 8 days; home (Estonia) isn't "away".
    expect(w.daysAway).toBe(11);
    expect(w.partial).toBe(false);
  });

  it("calls a country new only when nothing earlier is known there", () => {
    const w = build([v("IT", "2026-07-12", "2026-07-19"), v("IT", "2019-05-01", "2019-05-03"), v("JP", "2026-10-01", "2026-10-09"), v("NO", "2026-03-01", "2026-03-02")], [], ["NO"]);
    expect(w.newCountries).toEqual(["JP"]);
  });

  it("says when part of the year has no exact dates, and never invents days away", () => {
    const w = build([v("PT", null, null, { year: 2026 })]);
    expect(w.countries).toEqual(["PT"]);
    expect(w.partial).toBe(true);
    expect(w.daysAway).toBeNull();
    expect(w.journey).toEqual([]);
  });

  it("joins events into the journey, once per country in a row, and finds a clear busiest month", () => {
    const w = build([v("FI", "2026-07-30", "2026-08-02")], [e("Coldplay", "2026-07-31", "FI"), e("Billie Eilish", "2026-04-26", "NO"), e("Adele", "2026-07-10", "DE")]);
    expect(w.journey.map((s) => s.code)).toEqual(["NO", "DE", "FI"]);
    expect(w.busiestMonth).toEqual({ month: 7, count: 3 });
  });

  it("compares with last year only when there's last year; one event is a story too", () => {
    expect(build([v("FI", "2026-02-01", "2026-02-03")]).previous).toBeNull();
    expect(build([v("FI", "2026-02-01", "2026-02-03"), v("SE", "2025-02-01", "2025-02-03")]).previous).toEqual({ year: 2025, countries: 1, trips: 1, events: 0 });
    const one = build([], [e("Coldplay", "2026-07-31", "FI")]);
    expect(hasStory(one)).toBe(true);
    expect(hasStory(build([v("SE", "2025-02-01", "2025-02-03")]))).toBe(false);
  });
});

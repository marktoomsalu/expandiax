import { describe, expect, it } from "vitest";
import { buildWrapped, collageDefault, hasStory, spreadOrder, type WrappedEventRow, type WrappedVisit } from "./wrapped";

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

describe("Wrapped photos", () => {
  // One huge trip early in the year (Prague, 200 photos), then three small ones.
  const trips = [v("CZ", "2026-02-01", "2026-02-06"), v("CH", "2026-06-01", "2026-06-03"), v("IT", "2026-08-01", "2026-08-04"), v("PT", "2026-10-01", "2026-10-03")];
  const photos = [
    ...Array.from({ length: 200 }, (_, i) => ({ id: `cz${i}`, url: `u/cz${i}`, takenAt: `2026-02-0${1 + (i % 5)}`, label: "Czechia", code: "CZ", visitId: "CZ-2026-02-01" })),
    ...["CH", "IT", "PT"].flatMap((c, k) => Array.from({ length: 6 }, (_, i) => ({ id: `${c}${i}`, url: `u/${c}${i}`, takenAt: `2026-${["06", "08", "10"][k]}-0${1 + (i % 3)}`, label: c, code: c, visitId: trips[k + 1].id }))),
  ];
  const w = buildWrapped({ year: 2026, firstName: "Melody", homeCode: "EE", visits: trips, undatedCodes: [], events: [], photos });

  it("lets every trip in, not just the biggest one first", () => {
    expect(w.photos.length).toBe(80);
    for (const c of ["CH", "IT", "PT"]) expect(w.photos.filter((p) => p.code === c)).toHaveLength(6);
    // Still in the order they were taken.
    expect(w.photos.map((p) => p.takenAt)).toEqual([...w.photos.map((p) => p.takenAt)].sort());
  });

  it("starts the collage with a different trip and country in every photo, the same each time", () => {
    const ids = collageDefault(w);
    expect(ids).toHaveLength(5);
    const codes = ids.map((id) => w.photos.find((p) => p.id === id)!.code);
    expect(new Set(codes).size).toBe(4); // Czechia, Switzerland, Italy, Portugal (and one more of them)
    expect(collageDefault(w)).toEqual(ids);
  });

  it("spreads a trip's photos out: its middle, then its quarters", () => {
    expect(spreadOrder(8)).toEqual([4, 0, 6, 2, 5, 1, 7, 3]);
    expect([...spreadOrder(5)].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(spreadOrder(0)).toEqual([]);
  });
});


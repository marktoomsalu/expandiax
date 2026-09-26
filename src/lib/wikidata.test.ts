import { afterEach, describe, expect, it, vi } from "vitest";
import { dayFromTime, groupEditions, hitFromEntity, searchSportEvents, yearFromTime, type SportEventHit } from "./wikidata";

const item = (id: string) => ({ mainsnak: { datavalue: { value: { id } } } });
const time = (t: string, precision: number) => ({ mainsnak: { datavalue: { value: { time: t, precision } } } });
const text = (v: string) => ({ mainsnak: { datavalue: { value: v } } });
const ent = (id: string, name: string, claims: Record<string, unknown[]> = {}) => ({ id, labels: { en: { value: name } }, claims: claims as never });

describe("Wikidata dates", () => {
  it("uses a date only when it's precise to the day", () => {
    expect(dayFromTime({ time: "+2024-09-29T00:00:00Z", precision: 11 })).toBe("2024-09-29");
    expect(dayFromTime({ time: "+2025-00-00T00:00:00Z", precision: 9 })).toBeNull();
    expect(yearFromTime({ time: "+2025-00-00T00:00:00Z", precision: 9 })).toBe(2025);
    expect(yearFromTime({ time: "+2020-00-00T00:00:00Z", precision: 8 })).toBeNull(); // a decade
  });
});

describe("hitFromEntity", () => {
  const related = new Map(
    [
      ent("Q2736", "association football"),
      ent("Q183", "Germany", { P297: [text("DE")] }),
      ent("Q151374", "Berlin Olympic Stadium", { P131: [item("Q158")], P17: [item("Q183")] }),
      ent("Q158", "Charlottenburg-Wilmersdorf", { P31: [item("Q1165")], P131: [item("Q64")] }), // a borough
      ent("Q64", "Berlin", { P31: [item("Q200250")] }), // a metropolis
    ].map((e) => [e.id, e])
  );

  it("fills name, sport, day, venue, the real city (not the district) and country", () => {
    const final = ent("Q116968820", "UEFA Euro 2024 finals", {
      P585: [time("+2024-07-14T00:00:00Z", 11)],
      P276: [item("Q151374")],
      P17: [item("Q183")],
      P641: [item("Q2736")],
    });
    expect(hitFromEntity(final, related)).toMatchObject({
      name: "UEFA Euro 2024 finals",
      sport: "association football",
      date: "2024-07-14",
      venue: "Berlin Olympic Stadium",
      city: "Berlin",
      countryCode: "DE",
    });
  });

  it("a race held in a city: the city isn't shown as a venue", () => {
    const race = ent("Q118744428", "2024 Berlin Marathon", { P585: [time("+2024-09-29T00:00:00Z", 11)], P276: [item("Q64")], P17: [item("Q183")] });
    expect(hitFromEntity(race, related)).toMatchObject({ venue: null, city: "Berlin", date: "2024-09-29" });
  });

  it("a recurring race with no date: only the country", () => {
    const series = ent("Q56085672", "Ironman Tallinn", { P17: [item("Q191")] });
    expect(hitFromEntity(series, related)).toMatchObject({ date: null, year: null, city: null });
  });
});

describe("searchSportEvents", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("identifies itself, only searches items that have a sport, and ignores very short text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ query: { search: [] } }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await searchSportEvents("Ir")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    await searchSportEvents("Ironman Tallinn");
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).searchParams.get("srsearch")).toBe("Ironman Tallinn haswbstatement:P641");
    expect(init.headers["User-Agent"]).toContain("ExpandiaX");
  });
});

describe("groupEditions", () => {
  const h = (name: string, year: number | null): SportEventHit => ({
    id: name, name, year, description: null, sport: null, date: null, endDate: null, venue: null, city: null, countryCode: null, url: "",
  });
  it("keeps a race's years together, the race itself first and then newest first", () => {
    const out = groupEditions([h("Berlin Marathon", null), h("Berlin Marathon Inline Skating", null), h("2017 Berlin Marathon", 2017), h("2024 Berlin Marathon", 2024), h("2013 Berlin Marathon", 2013)]);
    expect(out.map((x) => x.name)).toEqual(["Berlin Marathon", "2024 Berlin Marathon", "2017 Berlin Marathon", "2013 Berlin Marathon", "Berlin Marathon Inline Skating"]);
  });
});

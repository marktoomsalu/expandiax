import { describe, expect, it } from "vitest";
import { byCloseness, groupLabel, groupTravellers, meetReasons, placesForYou, townsOf, type Traveller } from "./experienceNetwork";

const t = (id: string, over: Partial<Traveller> = {}): Traveller => ({
  id,
  username: id,
  display_name: id,
  avatar_url: null,
  home: null,
  following: false,
  stays: [{ id: `${id}-1`, name: "Trip", kind: "trip", when: "2019", lastDay: "2019-12-31", places: [] }],
  ...over,
});

describe("groupTravellers", () => {
  const now = new Date("2026-09-29");
  const people = [
    t("anna", { following: true, home: "EE" }),
    t("karl", { home: "EE", stays: [{ id: "k", name: "", kind: "lived", when: "", lastDay: "2026-06-01", places: ["Oslo"] }] }),
    t("sofia", { home: "IT" }),
  ];
  it("makes the rows that have people in them", () => {
    const g = groupTravellers(people, "EE", now);
    expect(g.map((x) => [x.key, x.people.map((p) => p.id)])).toEqual([
      ["network", ["anna"]],
      ["home", ["anna", "karl"]],
      ["lived", ["karl"]],
      ["recent", ["karl"]],
    ]);
  });
  it("skips the home row without a home country", () => {
    expect(groupTravellers(people, null, now).map((x) => x.key)).toEqual(["network", "lived", "recent"]);
  });
  it("orders a list by closeness", () => {
    expect([...people].sort(byCloseness).map((p) => p.id)).toEqual(["anna", "karl", "sofia"]);
  });
});

describe("townsOf", () => {
  it("counts each person once per town, busiest first", () => {
    const people = [
      t("a", { stays: [{ id: "1", name: "", kind: "trip", when: "", lastDay: "", places: ["Oslo", "Bergen"] }, { id: "2", name: "", kind: "trip", when: "", lastDay: "", places: ["oslo"] }] }),
      t("b", { stays: [{ id: "3", name: "", kind: "trip", when: "", lastDay: "", places: ["Oslo"] }] }),
    ];
    expect(townsOf(people).map((x) => [x.name, x.people.length])).toEqual([
      ["Oslo", 2],
      ["Bergen", 1],
    ]);
  });
});

describe("placesForYou", () => {
  const row = (userId: string, country: string, town: string) => ({ userId, country, town, lat: 1, lng: 1, cityId: `${userId}-${town}` });
  const viewer = { id: "me", following: new Set(["f1", "f2"]), dreamCountries: new Set<string>(), dreamTowns: new Set<string>() };
  it("puts the network's places first and leaves out your own", () => {
    const out = placesForYou(
      [row("x1", "IT", "Rome"), row("x2", "IT", "Rome"), row("x3", "IT", "Rome"), row("f1", "SI", "Bled"), row("f2", "SI", "Bled"), row("me", "AT", "Vienna"), row("f1", "AT", "Vienna")],
      viewer
    );
    expect(out.map((p) => [p.name, p.network.length, p.people.length])).toEqual([
      ["Bled", 2, 2],
      ["Rome", 0, 3],
    ]);
  });
  it("lifts places you dream of", () => {
    const out = placesForYou([row("x1", "IT", "Rome"), row("x2", "IT", "Rome"), row("x3", "PT", "Porto")], { ...viewer, dreamCountries: new Set(["PT"]) });
    expect(out[0].name).toBe("Porto");
  });
});

describe("meetReasons", () => {
  it("gives the strongest three", () => {
    expect(meetReasons({ countries: 12, home: "Estonia", livedIn: "Bologna", sharedTowns: 3, sharedLive: null }).map((r) => r.text)).toEqual([
      "Lived in Bologna",
      "3 shared places",
      "Also from Estonia",
    ]);
    expect(meetReasons({ countries: 1, home: null, livedIn: null, sharedTowns: 0, sharedLive: null }).map((r) => r.text)).toEqual(["Visited 1 country"]);
  });
});

describe("groupLabel", () => {
  it("reads naturally", () => {
    expect(groupLabel("network", 1, null)).toBe("1 person you follow has been here");
    expect(groupLabel("home", 12, "Estonia")).toBe("12 from Estonia have been here");
  });
});

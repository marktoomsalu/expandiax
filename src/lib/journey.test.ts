import { describe, expect, it } from "vitest";
import { buildJourney, type ChapterFacts } from "./journey";

const none: ChapterFacts = {
  steps: { introduce: false, map: false, trip: false, event: false, song: false, people: false, together: false, hello: false },
  countries: 0,
  following: 0,
  latestCountry: null,
  trip: null,
  event: null,
  finishedAt: null,
};

describe("Chapter One", () => {
  it("starts with all eight to do, the first one next", () => {
    const j = buildJourney(none);
    expect(j.total).toBe(8);
    expect(j.done).toBe(0);
    expect(j.next?.id).toBe("introduce");
    expect(j.steps.find((s) => s.id === "map")?.progress).toBe("0 of 3 countries");
  });

  it("can be done in any order: next is the first one still open", () => {
    const j = buildJourney({ ...none, steps: { ...none.steps, introduce: true, map: true, event: true }, countries: 5 });
    expect(j.done).toBe(3);
    expect(j.next?.id).toBe("trip");
  });

  it("buttons go to their own memories when there are some", () => {
    const j = buildJourney({ ...none, trip: { id: "t1", code: "IT" }, event: "e1", latestCountry: "IT" });
    expect(j.steps.find((s) => s.id === "trip")?.action).toEqual({ label: "Add a trip's photos", href: "/my-world/it/visits/t1/edit#photos" });
    expect(j.steps.find((s) => s.id === "song")?.action).toMatchObject({ href: "/my-world/it/visits/t1/edit#song" });
    expect(j.steps.find((s) => s.id === "together")?.action).toMatchObject({ href: "/my-world/it/visits/t1/edit#collaborators" });
  });

  it("with no trip yet, the photo step starts one in their latest country", () => {
    const j = buildJourney({ ...none, latestCountry: "PT" });
    expect(j.steps.find((s) => s.id === "trip")?.action).toMatchObject({ href: "/my-world/pt#add" });
  });

  it("finished once all eight are done, and stays finished", () => {
    const all = Object.fromEntries(Object.keys(none.steps).map((k) => [k, true])) as ChapterFacts["steps"];
    expect(buildJourney({ ...none, steps: all }).finished).toBe(true);
    expect(buildJourney({ ...none, finishedAt: "2026-11-18T10:00:00Z" }).finished).toBe(true);
  });
});

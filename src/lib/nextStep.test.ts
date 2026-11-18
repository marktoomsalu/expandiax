import { describe, expect, it } from "vitest";
import { currentStage, heldBack, pickNextStep, workOutStage, type CountrySignal, type History, type MemorySignal, type Signals } from "./nextStep";

const NOW = new Date("2026-11-18T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const country = (code: string, name: string, more: Partial<CountrySignal> = {}): CountrySignal => ({
  code,
  name,
  photos: 0,
  latestTripId: null,
  reminderOff: false,
  addedAt: "2026-11-01T00:00:00Z",
  ...more,
});
const trip = (id: string, label: string, more: Partial<MemorySignal> = {}): MemorySignal => ({
  kind: "trip",
  id,
  label,
  countryCode: "IT",
  countryName: label,
  date: "2025-08-01",
  photos: 0,
  hasSong: false,
  hasWords: false,
  hasJournal: false,
  people: 0,
  ...more,
});
const event = (id: string, label: string, more: Partial<MemorySignal> = {}): MemorySignal => ({ ...trip(id, label), kind: "event", countryCode: "GB", countryName: "United Kingdom", ...more });
const base = (more: Partial<Signals> = {}): Signals => ({
  countries: [],
  memories: [],
  following: 0,
  mutuals: 0,
  peopleLinked: 0,
  dreams: 0,
  worldConnects: 0,
  hasRealName: true,
  ...more,
});
const fresh: History = { stage: 0, moments: {}, pausedUntil: null };
const pick = (s: Signals, h: History = fresh, screen: "my-world" | "feed" = "my-world") => pickNextStep(s, h, { screen, now: NOW });

describe("stages", () => {
  it("starts at Arrived until a memory has a photo", () => {
    expect(workOutStage(base({ countries: [country("IT", "Italy")] }))).toBe(0);
    expect(workOutStage(base({ memories: [trip("t1", "Italy", { photos: 3 })] }))).toBe(1);
  });

  it("needs a growing world, then a story, then people", () => {
    const three = [trip("t1", "Italy", { photos: 3 }), trip("t2", "Spain"), event("e1", "Coldplay")];
    expect(workOutStage(base({ memories: three }))).toBe(2);
    const story = [trip("t1", "Italy", { photos: 3, hasSong: true }), trip("t2", "Spain"), event("e1", "Coldplay")];
    expect(workOutStage(base({ memories: story }))).toBe(3);
    expect(workOutStage(base({ memories: story, following: 3 }))).toBe(4);
    expect(workOutStage(base({ memories: story, peopleLinked: 1 }))).toBe(4);
  });

  it("never goes back", () => {
    expect(currentStage(base(), { ...fresh, stage: 3 })).toBe(3);
  });
});

describe("what it suggests", () => {
  it("first: the countries without photos, as choices", () => {
    const s = base({ countries: [country("IT", "Italy"), country("ES", "Spain", { addedAt: "2026-11-02T00:00:00Z" })] });
    const { stage, step } = pick(s);
    expect(stage).toBe(0);
    expect(step?.id).toBe("first-photos");
    expect(step?.chips?.map((c) => c.label)).toEqual(["Spain", "Italy"]);
    expect(step?.aboutPhotos).toBe(true);
  });

  it("someone who came in with an event: finish that night first", () => {
    const { step } = pick(base({ countries: [country("GB", "United Kingdom", { photos: 1 })], memories: [event("e1", "Taylor Swift", { photos: 0 })] }));
    expect(step?.id).toBe("finish-night");
    expect(step?.body).toContain("Taylor Swift");
    expect(step?.cta.href).toBe("/events/e1/edit#photos");
  });

  it("names their own places", () => {
    const s = base({
      countries: [country("IT", "Italy", { photos: 8, latestTripId: "t1" }), country("FR", "France"), country("ES", "Spain"), country("PT", "Portugal"), country("DE", "Germany")],
      memories: [trip("t1", "Italy", { photos: 8 }), trip("t2", "Greece", { photos: 2, countryName: "Greece" })],
    });
    const { step } = pick(s);
    expect(step?.id).toBe("other-half");
    expect(step?.title).toBe("Anything unforgettable in Italy?");
  });

  it("people already here get what they haven't done yet", () => {
    const s = base({
      countries: Array.from({ length: 12 }, (_, i) => country(`C${i}`, `Country ${i}`, { photos: 1, latestTripId: `t${i}` })),
      memories: [trip("t1", "Japan", { photos: 30, hasWords: true, people: 1, hasJournal: true }), event("e1", "Coldplay", { photos: 12, hasSong: true, people: 2 })],
      following: 20,
      mutuals: 3,
      dreams: 2,
    });
    const { stage, step } = pick(s, { ...fresh, stage: 0 });
    expect(stage).toBe(4);
    expect(step?.id).toBe("its-song");
    expect(step?.title).toBe("Give Japan its song");
    expect(step?.cta.href).toBe("/my-world/it/visits/t1/edit#song");
  });

  it("done is done: nothing left means nothing shown", () => {
    const s = base({
      countries: Array.from({ length: 12 }, (_, i) => country(`C${i}`, `Country ${i}`, { photos: 1, latestTripId: `t${i}` })),
      memories: [trip("t1", "Japan", { photos: 30, hasWords: true, hasSong: true, people: 1, hasJournal: true }), event("e1", "Coldplay", { photos: 12, hasSong: true, people: 2 })],
      following: 20,
      mutuals: 6,
      dreams: 2,
      worldConnects: 1,
    });
    expect(pick(s).step).toBeNull();
  });

  it("nothing social before their world has a story", () => {
    const s = base({ countries: [country("IT", "Italy", { photos: 3, latestTripId: "t1" }), country("FR", "France")], memories: [trip("t1", "Italy", { photos: 3 })] });
    const { stage, step } = pick(s);
    expect(stage).toBe(1);
    expect(step?.id).not.toBe("find-people");
    expect(step?.id).not.toBe("who-was-with-you");
  });

  it("the empty feed doesn't repeat its own Find friends", () => {
    const s = base({
      countries: [country("IT", "Italy", { photos: 9, latestTripId: "t1" }), country("FR", "France", { latestTripId: "t2" })],
      memories: [trip("t1", "Italy", { photos: 9, hasSong: true, people: 0 }), trip("t2", "France"), event("e1", "Coldplay", { photos: 2, hasSong: true })],
    });
    expect(pick(s, fresh, "my-world").step?.id).toBe("find-people");
    expect(pick(s, fresh, "feed").step?.id).not.toBe("find-people");
  });
});

describe("rules", () => {
  const s = base({ countries: [country("IT", "Italy"), country("ES", "Spain")] });

  it("Not now hides it for a week", () => {
    expect(heldBack({ id: "its-song" }, { ...fresh, moments: { "its-song": { dismissed: 1, dismissedAt: daysAgo(2) } } }, NOW)).toBe("not now");
    expect(heldBack({ id: "its-song" }, { ...fresh, moments: { "its-song": { dismissed: 1, dismissedAt: daysAgo(8) } } }, NOW)).toBeNull();
  });

  it("three times retires it, and some retire after one", () => {
    expect(heldBack({ id: "its-song" }, { ...fresh, moments: { "its-song": { dismissed: 3, dismissedAt: daysAgo(30) } } }, NOW)).toBe("retired");
    const h: History = { ...fresh, moments: { "first-photos": { dismissed: 1, dismissedAt: daysAgo(30) } } };
    expect(pick(s, h).step?.id).not.toBe("first-photos");
  });

  it("tapped but not done comes back after a few days", () => {
    expect(heldBack({ id: "x" }, { ...fresh, moments: { x: { taken: daysAgo(1) } } }, NOW)).toBe("taken");
    expect(heldBack({ id: "x" }, { ...fresh, moments: { x: { taken: daysAgo(4) } } }, NOW)).toBeNull();
  });

  it("a pause means nothing at all", () => {
    expect(pick(s, { ...fresh, pausedUntil: daysAgo(-3) }).step).toBeNull();
    expect(pick(s, { ...fresh, pausedUntil: daysAgo(1) }).step?.id).toBe("first-photos");
  });
});

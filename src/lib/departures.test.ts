import { describe, expect, it } from "vitest";
import { pickDepartures } from "./departures";

const d = (...codes: string[]) => codes.map((code) => ({ code }));
const now = new Date("2026-11-11T12:00:00Z");

describe("pickDepartures", () => {
  it("shows at most five", () => {
    expect(pickDepartures(d("A", "B", "C", "D", "E", "F", "G"), new Map(), now)).toHaveLength(5);
  });
  it("puts a country someone just went to at the top", () => {
    const activity = new Map([
      ["PE", "2026-11-10T09:00:00Z"],
      ["JP", "2026-11-01T09:00:00Z"],
      ["FR", "2025-01-01T09:00:00Z"],
    ]);
    const out = pickDepartures(d("FR", "IT", "ES", "PT", "DE", "JP", "PE"), activity, now).map((x) => x.code);
    expect(out.slice(0, 2)).toEqual(["PE", "JP"]);
    expect(out).toHaveLength(5);
  });
  it("takes turns with the rest from day to day", () => {
    const list = d("A", "B", "C", "D", "E", "F", "G");
    const today = pickDepartures(list, new Map(), now).map((x) => x.code);
    const tomorrow = pickDepartures(list, new Map(), new Date(now.getTime() + 86_400_000)).map((x) => x.code);
    expect(today).not.toEqual(tomorrow);
  });
});

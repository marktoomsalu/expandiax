import { describe, expect, it } from "vitest";
import { featuredEvent, placeSponsor, type Sponsor } from "./sponsors";

const list: Sponsor[] = [
  { kind: "place", id: "p1", countryCode: "PT", partner: "Visit Portugal", title: "t", body: "b", cta: "Go", url: "https://x", until: "2026-12-31" },
  { kind: "event", id: "e1", partner: "Fest", name: "Fest", date: "2026-12-01", venue: "v", city: "c", countryCode: "JP", url: "https://y", audience: ["JP"] },
];

describe("sponsors", () => {
  it("shows a country's partner card until it ends", () => {
    expect(placeSponsor("PT", "2026-11-07", list)?.id).toBe("p1");
    expect(placeSponsor("PT", "2027-01-01", list)).toBeNull();
    expect(placeSponsor("ES", "2026-11-07", list)).toBeNull();
  });

  it("shows a featured event only to its audience, and only before it happens", () => {
    expect(featuredEvent({ home: "EE", dreams: ["JP"] }, "2026-11-07", list)?.id).toBe("e1");
    expect(featuredEvent({ home: "EE", dreams: [] }, "2026-11-07", list)).toBeNull();
    expect(featuredEvent({ home: "JP", dreams: [] }, "2026-12-02", list)).toBeNull();
  });
});

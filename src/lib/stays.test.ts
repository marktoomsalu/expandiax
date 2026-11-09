import { describe, expect, it } from "vitest";
import { mapStays } from "./stays";

describe("map stays", () => {
  it("counts trips only, and marks where you lived", () => {
    const { visitCounts, livedCodes } = mapStays([
      { country_code: "IT", country_visits: [{ kind: "lived" }, { kind: "trip" }, { kind: "trip" }] },
      { country_code: "FR", country_visits: [{ kind: "trip" }] },
      { country_code: "ES", country_visits: [] },
      { country_code: "PT", country_visits: [{}] }, // older rows without a kind are trips
    ]);
    expect(visitCounts).toEqual({ IT: 2, FR: 1, ES: 0, PT: 1 });
    expect(livedCodes).toEqual(["IT"]);
  });
});

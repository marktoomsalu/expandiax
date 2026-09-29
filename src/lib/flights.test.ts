import { describe, expect, it, vi } from "vitest";

// Next's cache only runs inside Next; here every request goes straight through.
vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }));

import { aviasalesUrl, cheapest, flightsConfigured, gatewayFor, originFor } from "./flights";

describe("airports", () => {
  it("knows where to fly to in a country", () => {
    expect(gatewayFor("ES")).toBe("MAD");
    expect(gatewayFor("US")).toBe("NYC");
    expect(gatewayFor("TR")).toBe("IST");
    expect(gatewayFor("AD")).toBeNull();
  });
  it("flies from the nearest airport city, else the country's", () => {
    expect(originFor({ lat: 59.437, lng: 24.745 }, null)).toBe("TLL");
    expect(originFor({ countryCode: "FI" }, null)).toBe("HEL");
    expect(originFor(null, "EE")).toBe("TLL");
    expect(originFor(null, null)).toBeNull();
  });
});

describe("prices and links", () => {
  it("finds the cheapest round trip in the answer", () => {
    expect(
      cheapest({
        currency: "eur",
        data: {
          BCN: {
            "0": { price: 105, departure_at: "2027-01-27T20:55:00+02:00", return_at: "2027-03-10T15:30:00+01:00" },
            "1": { price: 89, departure_at: "2026-11-02T06:10:00+02:00", return_at: "2026-11-09T18:00:00+01:00" },
          },
        },
      })
    ).toEqual({ price: 89, currency: "EUR", depart: "2026-11-02", back: "2026-11-09" });
    expect(cheapest({ data: {} })).toBeNull();
  });
  it("links to that exact trip on Aviasales with our marker", () => {
    expect(aviasalesUrl("TLL", "BCN", "2027-01-27", "2027-03-10", "12345")).toBe("https://www.aviasales.com/search/TLL2701BCN10031?marker=12345");
  });
  it("needs both the token and the marker", () => {
    expect(flightsConfigured({ TRAVELPAYOUTS_TOKEN: "t" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(flightsConfigured({ TRAVELPAYOUTS_TOKEN: "t", TRAVELPAYOUTS_MARKER: "m" } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });
});

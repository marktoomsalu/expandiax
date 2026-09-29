import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NearbyEvent } from "./concerts";
import { fientaNearby, nearbyFromFienta, nearbyFromSeatGeek, nearbyFromSkiddle, parsePrice, seatgeekNearby, skiddleNearby, sourcesCredit, weave } from "./eventSources";

const w = { from: "2026-09-29", until: "2026-12-28" };

describe("parsePrice", () => {
  it("reads prices however they're written", () => {
    expect(parsePrice("5 EUR")).toEqual({ amount: 5, currency: "EUR" });
    expect(parsePrice("£15.00")).toEqual({ amount: 15, currency: "GBP" });
    expect(parsePrice("12,50 €")).toEqual({ amount: 12.5, currency: "EUR" });
    expect(parsePrice("0 EUR")).toBeNull();
    expect(parsePrice("")).toBeNull();
  });
});

describe("Fienta", () => {
  const base = { id: 1, title: "Jazz night", starts_at: "2026-10-08 19:00:00", attendance_mode: "offline", venue: "Philly Joe's, Vana-Posti 7", categories: ["music"], price_from_string: "15 EUR", buy_tickets_url: "https://fienta.com/jazz" };
  it("turns a going-out event into a card", () => {
    expect(nearbyFromFienta(base, { countryCode: "EE", city: "Tallinn" })).toMatchObject({
      id: "fienta-1",
      name: "Jazz night",
      date: "2026-10-08",
      time: "19:00",
      venue: "Philly Joe's",
      city: "Tallinn",
      category: "music",
      priceFrom: { amount: 15, currency: "EUR" },
      source: "fienta",
    });
  });
  it("files each event under its own chip", () => {
    const place = { countryCode: "EE", city: null };
    const cat = (categories: string[]) => nearbyFromFienta({ ...base, categories }, place)?.category;
    expect(cat(["music", "festival"])).toBe("festival");
    expect(cat(["music"])).toBe("music");
    expect(cat(["sports"])).toBe("sport");
    expect(cat(["conference"])).toBe("conference");
    expect(cat(["business"])).toBe("conference");
    expect(cat(["theatre"])).toBe("arts");
  });
  it("leaves out workshops, online events and cancellations", () => {
    const place = { countryCode: "EE", city: null };
    expect(nearbyFromFienta({ ...base, categories: ["spirituality"] }, place)).toBeNull();
    expect(nearbyFromFienta({ ...base, attendance_mode: "online" }, place)).toBeNull();
    expect(nearbyFromFienta({ ...base, event_status: "cancelled" }, place)).toBeNull();
  });

  describe("searching", () => {
    const fetchMock = vi.fn();
    const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
    beforeEach(() => vi.stubGlobal("fetch", fetchMock));
    afterEach(() => {
      vi.unstubAllGlobals();
      fetchMock.mockReset();
    });
    it("asks by town, and widens to the country when the town is quiet", async () => {
      fetchMock.mockResolvedValueOnce(json({ events: [base] }));
      fetchMock.mockResolvedValueOnce(json({ events: [base, { ...base, id: 2, title: "Tartu folk" }] }));
      const events = await fientaNearby({ lat: 59.4, lng: 24.7, city: "Tallinn", countryCode: "EE" }, w);
      const first = new URL(fetchMock.mock.calls[0][0]);
      expect(first.searchParams.get("city")).toBe("Tallinn");
      expect(first.searchParams.get("starts_from")).toBe("2026-09-29 00:00:00");
      expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get("country")).toBe("EE");
      expect(events.map((e) => e.name)).toEqual(["Jazz night", "Tartu folk"]);
    });
    it("stays quiet with nowhere to look", async () => {
      expect(await fientaNearby({ lat: 1, lng: 1 }, w)).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
    it("asks Skiddle and SeatGeek only with a key, and only in their part of the world", async () => {
      expect(await skiddleNearby({ countryCode: "GB" }, w)).toEqual([]);
      process.env.SKIDDLE_API_KEY = "k";
      process.env.SEATGEEK_CLIENT_ID = "c";
      expect(await skiddleNearby({ countryCode: "EE" }, w)).toEqual([]);
      expect(await seatgeekNearby({ lat: 59.4, lng: 24.7 }, w)).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
      fetchMock.mockResolvedValueOnce(json({ results: [] }));
      await skiddleNearby({ lat: 53.48, lng: -2.24 }, w);
      const skiddle = new URL(fetchMock.mock.calls[0][0]);
      expect(skiddle.searchParams.get("radius")).toBe("30");
      expect(skiddle.searchParams.get("minDate")).toBe("2026-09-29");
      fetchMock.mockResolvedValueOnce(json({ events: [] }));
      await seatgeekNearby({ countryCode: "US" }, w);
      expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get("venue.country")).toBe("US");
      delete process.env.SKIDDLE_API_KEY;
      delete process.env.SEATGEEK_CLIENT_ID;
    });
  });
});

describe("Skiddle and SeatGeek listings", () => {
  it("reads a Skiddle event", () => {
    expect(
      nearbyFromSkiddle({ id: 9, eventname: "Warehouse Project", date: "2026-10-10", EventCode: "CLUB", venue: { name: "Depot Mayfield", town: "Manchester", country: "GB" }, entryprice: "£35.00", openingtimes: { doorsopen: "20:00" }, artists: [{ name: "Peggy Gou" }] })
    ).toMatchObject({ id: "skiddle-9", city: "Manchester", category: "music", time: "20:00", priceFrom: { amount: 35, currency: "GBP" }, performers: ["Peggy Gou"], source: "skiddle" });
    expect(nearbyFromSkiddle({ id: 1, eventname: "X", date: "2026-10-10", cancelled: "1" })).toBeNull();
    expect(nearbyFromSkiddle({ id: 2, eventname: "Parklife", date: "2026-10-10", EventCode: "FEST" })?.category).toBe("festival");
  });
  it("reads a SeatGeek event", () => {
    expect(
      nearbyFromSeatGeek({ id: 5, title: "Knicks at Celtics", datetime_local: "2026-11-02T19:30:00", type: "nba", venue: { name: "TD Garden", city: "Boston", country: "US" }, performers: [{ name: "Boston Celtics", image: "https://x/c.jpg" }], stats: { lowest_price: 89 } })
    ).toMatchObject({ id: "seatgeek-5", date: "2026-11-02", time: "19:30", category: "sport", city: "Boston", image: "https://x/c.jpg", priceFrom: { amount: 89, currency: "USD" } });
  });
});

describe("weave", () => {
  const ev = (id: string, date: string, name = id): NearbyEvent => ({ id, name, date, time: null, venue: "", city: "", countryCode: null, url: null, image: null, category: "music", genre: null, performers: [], priceFrom: null, moreDates: 0 });
  it("gives each source its turn, so a busy one can't crowd out the rest", () => {
    const busy = [ev("f1", "2026-10-01"), ev("f2", "2026-10-01"), ev("f3", "2026-10-02"), ev("f4", "2026-10-02")];
    const quiet = [ev("t1", "2026-11-20")];
    expect(weave([busy, quiet], 3).map((e) => e.id)).toEqual(["f1", "f2", "t1"]);
  });
  it("shows the same show only once", () => {
    expect(weave([[ev("a", "2026-10-01", "Sting 3.0")], [ev("b", "2026-10-01", "STING 3.0!")]], 10)).toHaveLength(1);
  });
  it("credits exactly the sources shown", () => {
    expect(sourcesCredit(["ticketmaster", "fienta", "fienta"])).toBe("Events from Ticketmaster and Fienta");
    expect(sourcesCredit([undefined])).toBeNull();
  });
});

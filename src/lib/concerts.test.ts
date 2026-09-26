import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  artistsSeenLive,
  collapseRuns,
  geohash,
  nearbyEvents,
  nearbyFromTicketmaster,
  ticketmasterImage,
  pastShowFromSetlist,
  searchPastShows,
  tourHighlights,
  upcomingFromBandsintown,
  upcomingFromTicketmaster,
  upcomingShows,
  type UpcomingShow,
} from "./concerts";

// Shapes follow each service's documented responses.
const setlist = (over: Record<string, unknown> = {}) => ({
  id: "63de4613",
  eventDate: "23-08-2025",
  url: "https://www.setlist.fm/setlist/x.html",
  tour: { name: "Summer Tour" },
  venue: { name: "Tallinn Song Festival Grounds", city: { name: "Tallinn", country: { code: "EE", name: "Estonia" } } },
  sets: { set: [{ song: [{ name: "Flying Theme", tape: true }, { name: "Yellow" }, { name: "Clocks" }] }, { encore: 1, song: [{ name: "Fix You" }, { name: "Yellow" }] }] },
  ...over,
});

describe("pastShowFromSetlist", () => {
  it("turns a setlist.fm entry into a show we can fill the form from", () => {
    expect(pastShowFromSetlist(setlist())).toEqual({
      id: "63de4613",
      date: "2025-08-23",
      venue: "Tallinn Song Festival Grounds",
      city: "Tallinn",
      countryCode: "EE",
      countryName: "Estonia",
      tour: "Summer Tour",
      songs: ["Yellow", "Clocks", "Fix You"], // encore included, repeats and recorded intros removed
      url: "https://www.setlist.fm/setlist/x.html",
    });
  });
  it("copes with a show that has no setlist or tour yet", () => {
    const s = pastShowFromSetlist(setlist({ sets: { set: [] }, tour: undefined }));
    expect(s?.songs).toEqual([]);
    expect(s?.tour).toBeNull();
  });
  it("ignores entries with a broken date", () => {
    expect(pastShowFromSetlist(setlist({ eventDate: "2025-08-23" }))).toBeNull();
  });
});

describe("upcoming show conversion", () => {
  it("Bandsintown: maps country names to our countries", () => {
    const s = upcomingFromBandsintown({
      id: 13722599,
      datetime: "2026-11-02T19:00:00",
      url: "https://www.bandsintown.com/e/13722599",
      venue: { name: "O2 Arena", city: "London", country: "United Kingdom" },
    });
    expect(s).toMatchObject({ id: "bit-13722599", date: "2026-11-02", city: "London", countryCode: "GB", source: "bandsintown" });
    expect(upcomingFromBandsintown({ id: 1, datetime: "x", venue: { country: "Czech Republic" } })).toBeNull();
    expect(upcomingFromBandsintown({ id: 2, datetime: "2026-12-01T20:00:00", venue: { country: "Czech Republic" } })?.countryCode).toBe("CZ");
  });

  it("Ticketmaster: keeps only events the artist actually plays", () => {
    const ev = (attractions: string[]) => ({
      id: "vv1",
      url: "https://www.ticketmaster.com/e/vv1",
      dates: { start: { localDate: "2026-12-05" } },
      _embedded: { venues: [{ name: "Ziggo Dome", city: { name: "Amsterdam" }, country: { countryCode: "NL" } }], attractions: attractions.map((name) => ({ name })) },
    });
    expect(upcomingFromTicketmaster(ev(["Coldplay"]), "Coldplay")).toMatchObject({ date: "2026-12-05", countryCode: "NL", source: "ticketmaster" });
    expect(upcomingFromTicketmaster(ev(["Coldplay Tribute Band"]), "Coldplay")).toBeNull();
  });
});

describe("fetching (services mocked)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-26T12:00:00Z"));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    fetchMock.mockReset();
    delete process.env.SETLISTFM_API_KEY;
    delete process.env.BANDSINTOWN_APP_ID;
    delete process.env.TICKETMASTER_API_KEY;
  });
  const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

  it("past shows: needs a key", async () => {
    await expect(searchPastShows("Coldplay")).rejects.toThrow("not_configured");
  });

  it("past shows: picks the exact artist, sends the key, newest first, no future shows", async () => {
    process.env.SETLISTFM_API_KEY = "k";
    fetchMock
      .mockResolvedValueOnce(json({ artist: [{ mbid: "wrong", name: "Coldplay Tribute" }, { mbid: "cc197bad", name: "Coldplay" }] }))
      .mockResolvedValueOnce(
        json({
          setlist: [setlist({ id: "old", eventDate: "01-06-2023" }), setlist({ id: "future", eventDate: "01-06-2027" }), setlist({ id: "new", eventDate: "20-07-2025" })],
          total: 3,
          page: 1,
          itemsPerPage: 20,
        })
      );
    const r = await searchPastShows("coldplay", { year: 2025 });
    const [artistUrl, init] = fetchMock.mock.calls[0];
    expect(artistUrl).toContain("/search/artists?artistName=coldplay");
    expect(init.headers["x-api-key"]).toBe("k");
    expect(fetchMock.mock.calls[1][0]).toContain("artistMbid=cc197bad");
    expect(fetchMock.mock.calls[1][0]).toContain("year=2025");
    expect(r.shows.map((s) => s.id)).toEqual(["new", "old"]);
  });

  it("past shows: an artist setlist.fm doesn't know gives an empty list, not an error", async () => {
    process.env.SETLISTFM_API_KEY = "k";
    fetchMock.mockResolvedValueOnce(json({ code: 404, message: "not found" }, 404));
    expect((await searchPastShows("Nobody Ever")).shows).toEqual([]);
  });

  it("upcoming: needs a key", async () => {
    await expect(upcomingShows("Coldplay")).rejects.toThrow("not_configured");
  });

  it("upcoming via Bandsintown: soonest first, past and duplicate dates dropped", async () => {
    process.env.BANDSINTOWN_APP_ID = "app";
    fetchMock.mockResolvedValueOnce(
      json([
        { id: 2, datetime: "2026-12-01T20:00:00", venue: { name: "B", city: "Riga", country: "Latvia" } },
        { id: 1, datetime: "2026-10-10T20:00:00", venue: { name: "A", city: "Tallinn", country: "Estonia" } },
        { id: 3, datetime: "2026-10-10T20:00:00", venue: { name: "A", city: "Tallinn Old Town", country: "Estonia" } },
        { id: 4, datetime: "2026-09-01T20:00:00", venue: { name: "Old", city: "Oslo", country: "Norway" } },
      ])
    );
    const shows = await upcomingShows("Coldplay");
    expect(fetchMock.mock.calls[0][0]).toContain("/artists/Coldplay/events?app_id=app&date=upcoming");
    expect(shows.map((s) => s.city)).toEqual(["Tallinn", "Riga"]);
  });

  it("upcoming via Ticketmaster when Bandsintown isn't set up: looks the artist up first", async () => {
    process.env.TICKETMASTER_API_KEY = "tm";
    fetchMock.mockResolvedValueOnce(json({ _embedded: { attractions: [{ id: "K8tribute", name: "Coldplay Tribute" }, { id: "K8vZ", name: "Coldplay" }] } }));
    fetchMock.mockResolvedValueOnce(
      json({
        _embedded: {
          events: [
            { id: "a", dates: { start: { localDate: "2026-11-01" } }, _embedded: { venues: [{ name: "X", city: { name: "Berlin" }, country: { countryCode: "DE" } }], attractions: [{ name: "Coldplay" }] } },
          ],
        },
      })
    );
    const shows = await upcomingShows("Coldplay");
    expect(fetchMock.mock.calls[0][0]).toContain("discovery/v2/attractions.json");
    expect(fetchMock.mock.calls[1][0]).toContain("discovery/v2/events.json");
    expect(fetchMock.mock.calls[1][0]).toContain("attractionId=K8vZ");
    expect(shows).toHaveLength(1);
    expect(shows[0]).toMatchObject({ city: "Berlin", countryCode: "DE" });
  });

  it("upcoming: a service error gives an empty list rather than breaking the page", async () => {
    process.env.BANDSINTOWN_APP_ID = "app";
    fetchMock.mockResolvedValueOnce(json({ Message: "denied" }, 403));
    expect(await upcomingShows("Coldplay")).toEqual([]);
  });
});

describe("your artists on tour", () => {
  it("lists each artist seen live once, most recently seen first, concerts only", () => {
    const ev = (event_type: string, title: string, event_date: string, spotify_artist_name: string | null = null, spotify_artist_image: string | null = null) => ({
      event_type, title, event_date, spotify_artist_name, spotify_artist_image,
    });
    expect(
      artistsSeenLive([
        ev("concert", "Coldplay", "2023-06-01", null, "https://i.scdn.co/cp.jpg"),
        ev("concert", "Music of the Spheres", "2025-07-20", "Coldplay"),
        ev("festival", "Glastonbury", "2026-06-25"),
        ev("concert", "Dua Lipa", "2024-05-01"),
      ])
    ).toEqual([
      { name: "Coldplay", image: "https://i.scdn.co/cp.jpg" }, // photo kept from the older entry
      { name: "Dua Lipa", image: null },
    ]);
  });

  it("puts dates in your home country first", () => {
    const show = (id: string, date: string, countryCode: string): UpcomingShow => ({
      id, date, countryCode, venue: "V", city: "C", countryName: null, url: null, image: null, source: "bandsintown",
    });
    const r = tourHighlights(
      [
        { artist: "A", shows: [show("a1", "2026-10-01", "DE"), show("a2", "2026-10-02", "FR"), show("a3", "2026-10-03", "DE")] },
        { artist: "B", shows: [show("b1", "2026-12-01", "DE"), show("b2", "2027-01-10", "EE")] },
        { artist: "Nobody", shows: [] },
      ],
      "EE"
    );
    expect(r.map((a) => a.artist)).toEqual(["B", "A"]);
    expect(r[0].shows.map((s) => s.id)).toEqual(["b2", "b1"]);
    expect(r[1]).toMatchObject({ total: 3 });
    expect(r[1].shows).toHaveLength(2);
  });
});

describe("happening near you (Ticketmaster)", () => {
  const tmEvent = (over: Record<string, unknown> = {}) => ({
    id: "G5v",
    name: "Sting 3.0",
    url: "https://www.ticketmaster.fi/event/G5v",
    images: [
      { ratio: "3_2", url: "https://s1.ticketm.net/a_3_2.jpg", width: 640 },
      { ratio: "16_9", url: "https://s1.ticketm.net/a_16_9_2048.jpg", width: 2048 },
      { ratio: "16_9", url: "https://s1.ticketm.net/a_16_9_640.jpg", width: 640 },
      { ratio: "16_9", url: "https://s1.ticketm.net/a_16_9_205.jpg", width: 205 },
    ],
    dates: { start: { localDate: "2026-10-12", localTime: "19:30:00" }, status: { code: "onsale" } },
    classifications: [{ segment: { name: "Music" }, genre: { name: "Rock" } }],
    priceRanges: [{ min: 69.5, currency: "EUR" }, { min: 49, currency: "EUR" }],
    _embedded: {
      venues: [{ name: "Helsinki Ice Hall", city: { name: "Helsinki" }, country: { countryCode: "FI" } }],
      attractions: [{ name: "Sting" }],
    },
    ...over,
  });

  it("picks a sharp but not huge wide photo", () => {
    expect(ticketmasterImage(tmEvent().images)).toBe("https://s1.ticketm.net/a_16_9_640.jpg");
    expect(ticketmasterImage([{ ratio: "16_9", url: "fallback.jpg", width: 1024, fallback: true }, { ratio: "16_9", url: "real.jpg", width: 305 }])).toBe("real.jpg");
    expect(ticketmasterImage([])).toBeNull();
  });

  it("turns an event into a card", () => {
    expect(nearbyFromTicketmaster(tmEvent())).toEqual({
      id: "tm-G5v",
      name: "Sting 3.0",
      date: "2026-10-12",
      time: "19:30",
      venue: "Helsinki Ice Hall",
      city: "Helsinki",
      countryCode: "FI",
      url: "https://www.ticketmaster.fi/event/G5v",
      image: "https://s1.ticketm.net/a_16_9_640.jpg",
      category: "music",
      genre: "Rock",
      performers: ["Sting"],
      priceFrom: { amount: 49, currency: "EUR" },
      moreDates: 0,
    });
  });

  it("drops parking passes, add-ons and cancelled events", () => {
    expect(nearbyFromTicketmaster(tmEvent({ name: "PARKING: Sting 3.0" }))).toBeNull();
    expect(nearbyFromTicketmaster(tmEvent({ name: "Sting - VIP Package Upgrade" }))).toBeNull();
    expect(nearbyFromTicketmaster(tmEvent({ dates: { start: { localDate: "2026-10-12" }, status: { code: "cancelled" } } }))).toBeNull();
  });

  it("shows a long run once", () => {
    const e = nearbyFromTicketmaster(tmEvent({ name: "The Lion King", classifications: [{ segment: { name: "Arts & Theatre" } }] }))!;
    const runs = collapseRuns([e, { ...e, id: "2", date: "2026-10-13" }, { ...e, id: "3", date: "2026-10-14" }, { ...e, id: "x", name: "Other", date: "2026-10-13" }]);
    expect(runs.map((r) => [r.name, r.date, r.moreDates])).toEqual([["The Lion King", "2026-10-12", 2], ["Other", "2026-10-13", 0]]);
    expect(runs[0].category).toBe("arts");
  });

  it("geohash matches the reference implementation", () => {
    expect(geohash(57.64911, 10.40744, 11)).toBe("u4pruydqqvj"); // Wikipedia's example
    expect(geohash(59.437, 24.7536)).toHaveLength(4);
  });

  describe("fetching", () => {
    const fetchMock = vi.fn();
    const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
    beforeEach(() => {
      vi.stubGlobal("fetch", fetchMock);
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-09-26T12:00:00Z"));
    });
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
      fetchMock.mockReset();
      delete process.env.TICKETMASTER_API_KEY;
    });

    it("needs a Ticketmaster key", async () => {
      await expect(nearbyEvents({ countryCode: "EE" })).rejects.toThrow("not_configured");
    });

    it("searches around the point, all languages, next 3 months — and widens when it's quiet", async () => {
      process.env.TICKETMASTER_API_KEY = "tm";
      fetchMock.mockResolvedValueOnce(json({ _embedded: { events: [tmEvent()] } }));
      fetchMock.mockResolvedValueOnce(json({ _embedded: { events: [tmEvent(), tmEvent({ id: "b", name: "Other show" })] } }));
      const events = await nearbyEvents({ lat: 59.437, lng: 24.7536 });
      const first = new URL(fetchMock.mock.calls[0][0]);
      expect(first.searchParams.get("geoPoint")).toBe(geohash(59.437, 24.7536));
      expect(first.searchParams.get("radius")).toBe("100");
      expect(first.searchParams.get("locale")).toBe("*");
      expect(first.searchParams.get("startDateTime")).toBe("2026-09-26T00:00:00Z");
      expect(first.searchParams.get("endDateTime")).toBe("2026-12-25T23:59:59Z");
      expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get("radius")).toBe("400");
      expect(events.map((e) => e.name)).toEqual(["Sting 3.0", "Other show"]);
    });

    it("falls back to the whole home country", async () => {
      process.env.TICKETMASTER_API_KEY = "tm";
      fetchMock.mockResolvedValueOnce(json({}));
      expect(await nearbyEvents({ countryCode: "EE" })).toEqual([]);
      expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("countryCode")).toBe("EE");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});

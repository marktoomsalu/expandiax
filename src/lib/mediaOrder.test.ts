import { describe, expect, it } from "vitest";
import { orderCountryMedia, placeByTime } from "./mediaOrder";

const m = (id: string, visit: string | null, order: number) => ({ id, country_visit_id: visit, display_order: order });
const rome = { id: "rome", year: 2022, visited_from: "2022-06-01", visited_to: "2022-06-07", cover_media_id: "r2" };
const bologna = { id: "bologna", year: 2026, visited_from: "2026-09-01", visited_to: "2027-06-30", cover_media_id: null };
const media = [m("r1", "rome", 0), m("r2", "rome", 1), m("b1", "bologna", 2), m("loose", null, 3)];

describe("orderCountryMedia", () => {
  it("puts the newest trip first, each trip starting with its cover, loose photos last", () => {
    expect(orderCountryMedia(media, [rome, bologna], null).map((x) => x.id)).toEqual(["b1", "r2", "r1", "loose"]);
  });

  it("lets a cover you chose for the country lead", () => {
    expect(orderCountryMedia(media, [rome, bologna], "r1").map((x) => x.id)).toEqual(["r1", "b1", "r2", "loose"]);
  });

  it("keeps upload order when there are no trips", () => {
    expect(orderCountryMedia(media, [], null).map((x) => x.id)).toEqual(["r1", "r2", "b1", "loose"]);
  });
});


describe("placeByTime", () => {
  const e = (id: string, order: number, takenAt: string | null) => ({ id, order, takenAt });
  it("slots new photos in by when they were taken", () => {
    const out = placeByTime(
      [e("a", 0, "2026-07-01T10:00"), e("b", 1, "2026-07-03T10:00")],
      [{ key: "new2", takenAt: "2026-07-04T09:00" }, { key: "new1", takenAt: "2026-07-02T09:00" }]
    );
    expect(out.map((x) => x.id)).toEqual(["a", "new1", "b", "new2"]);
  });

  it("keeps an order arranged by hand, and puts undated new photos last", () => {
    const out = placeByTime([e("b", 0, "2026-07-03T10:00"), e("a", 1, "2026-07-01T10:00")], [{ key: "n", takenAt: null }, { key: "m", takenAt: "2026-07-05T10:00" }]);
    expect(out.map((x) => x.id)).toEqual(["b", "a", "m", "n"]);
  });

  it("orders a first batch by time", () => {
    const out = placeByTime([], [{ key: "late", takenAt: "2026-07-05T10:00" }, { key: "early", takenAt: "2026-07-01T10:00" }]);
    expect(out.map((x) => x.id)).toEqual(["early", "late"]);
  });
});

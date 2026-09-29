import { describe, expect, it } from "vitest";
import { staysUrl, thingsToDoUrl, tripLinks } from "./partners";

const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;

describe("partner links", () => {
  it("stay hidden until a partner ID is set", () => {
    expect(tripLinks("Barcelona", env({}))).toEqual([]);
  });
  it("link to GetYourGuide with our partner ID", () => {
    expect(thingsToDoUrl("São Paulo", env({ GETYOURGUIDE_PARTNER_ID: "ABC123" }))).toBe(
      "https://www.getyourguide.com/s/?q=S%C3%A3o%20Paulo&partner_id=ABC123&cmp=expandiax"
    );
  });
  it("link to Booking.com directly, or through Awin", () => {
    expect(staysUrl("Kyoto", env({ BOOKING_AID: "999" }))).toBe("https://www.booking.com/searchresults.html?ss=Kyoto&aid=999");
    const awin = new URL(staysUrl("Kyoto", env({ AWIN_AFFILIATE_ID: "11", BOOKING_AWIN_MID: "6776" }))!);
    expect(awin.hostname).toBe("www.awin1.com");
    expect(awin.searchParams.get("awinmid")).toBe("6776");
    expect(awin.searchParams.get("ued")).toBe("https://www.booking.com/searchresults.html?ss=Kyoto");
  });
  it("list stays first, then things to do", () => {
    expect(tripLinks("Rome", env({ BOOKING_AID: "1", GETYOURGUIDE_PARTNER_ID: "2" })).map((l) => l.label)).toEqual(["Stays", "Things to do"]);
  });
});

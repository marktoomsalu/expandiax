import { describe, expect, it } from "vitest";
import { inviteMessage, momentMessage, whatsappUrl } from "./invite";

const URL_ = "https://expandiax.com/join/mark";

describe("invite messages", () => {
  it("says what they've kept, with the link on its own line", () => {
    const m = inviteMessage(URL_, { countries: 37, events: 12 });
    expect(m).toContain("37 countries and 12 events so far.");
    expect(m.split("\n").at(-1)).toBe(URL_);
  });

  it("leaves the numbers out when there's little to say", () => {
    expect(inviteMessage(URL_, { countries: 1, events: 0 })).not.toMatch(/so far/);
    expect(inviteMessage(URL_)).toContain("we'll follow each other automatically");
  });

  it("a memory: their name and the trip's", () => {
    const m = momentMessage("https://expandiax.com/join/mark?m=abc", { name: "Karla Tamm", noun: "trip", title: "Portugal 2025" });
    expect(m.startsWith("Hey Karla! I added our trip, Portugal 2025, to ExpandiaX")).toBe(true);
  });

  it("WhatsApp gets the whole message, encoded", () => {
    expect(whatsappUrl("Hi & bye\nhttps://x.y")).toBe("https://wa.me/?text=Hi%20%26%20bye%0Ahttps%3A%2F%2Fx.y");
  });
});

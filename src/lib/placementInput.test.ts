import { describe, expect, it } from "vitest";
import { parsePlacement } from "./placementInput";

const event = { kind: "event", partner: "Ahotu", countryCode: "de", url: "https://www.bmw-berlin-marathon.com", name: "BMW Berlin Marathon", eventDate: "2027-09-26", city: "Berlin", audience: ["de", "xx", "AT"] };

describe("partner placement input", () => {
  it("an event: country upper-cased, unknown audience codes dropped", () => {
    const r = parsePlacement(event);
    expect("row" in r && r.row).toMatchObject({ kind: "event", country_code: "DE", name: "BMW Berlin Marathon", event_date: "2027-09-26", audience: ["DE", "AT"], active: true });
  });

  it("says what's missing, in plain words", () => {
    expect(parsePlacement({ ...event, url: "http://insecure.example" })).toEqual({ error: "The link must be a full https:// address." });
    expect(parsePlacement({ ...event, eventDate: "" })).toEqual({ error: "When is the event?" });
    expect(parsePlacement({ ...event, countryCode: "ZZ" })).toEqual({ error: "Choose the country." });
    expect(parsePlacement({ ...event, startsOn: "2027-02-01", until: "2027-01-01" })).toEqual({ error: "It ends before it starts." });
  });

  it("a country card needs its title, text and button", () => {
    const card = { kind: "place", partner: "Visit Portugal", countryCode: "PT", url: "https://www.visitportugal.com" };
    expect(parsePlacement(card)).toEqual({ error: "A country card needs a title, its text and the button's words." });
    const ok = parsePlacement({ ...card, title: "Portugal in spring", body: "Our guide to the coast.", cta: "Read the guide" });
    expect("row" in ok && ok.row).toMatchObject({ kind: "place", title: "Portugal in spring", event_date: null });
  });
});

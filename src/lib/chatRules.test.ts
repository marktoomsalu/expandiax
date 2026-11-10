import { describe, expect, it } from "vitest";
import { chatProblem } from "./chatRules";

const ok = (t: string, first = true) => expect(chatProblem(t, first)).toBeNull();
const no = (t: string, first = true) => expect(chatProblem(t, first)).not.toBeNull();

describe("chatProblem", () => {
  it("lets ordinary travel talk through", () => {
    ok("Hi Melody! I saw your Bologna stay - where should I eat on my first night there?");
    ok("Was it worth it in 2022 and 2026? Where do I buy a SIM card at the airport?");
    ok("How much was the train from Rome to Florence, roughly €20?");
    ok("We stayed 3 nights, 12-15 July 2025. Any tips for Kotor?");
  });

  it("stops selling and spam in a first message", () => {
    no("Special offer: cheap flights to Bali, order now!");
    no("I'm selling my tour packages, best prices");
    no("Check out www.mytours.com");
    no("Visit https://bit.ly/abc for more");
    no("message me on whatsapp");
    no("Call me +372 5123 4567");
    no("write to me at tom@example.com");
  });

  it("stops scams everywhere, even between friends", () => {
    no("Invest with me in bitcoin, guaranteed returns", false);
    no("send me a gift card", false);
  });

  it("lets friends share links and numbers", () => {
    ok("Here's the place: https://maps.google.com/xyz", false);
    ok("my number is +372 5123 4567", false);
  });
});

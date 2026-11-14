import { describe, expect, it } from "vitest";
import { namesTogether } from "./collab";

describe("namesTogether", () => {
  it("says who shared a post, by first name", () => {
    expect(namesTogether(["Mark Toomsalu"])).toBe("Mark");
    expect(namesTogether(["Mark Toomsalu", "Melody Nirk"])).toBe("Mark & Melody");
    expect(namesTogether(["Mark", "Melody", "Anna"])).toBe("Mark, Melody & Anna");
    expect(namesTogether(["Mark", "Melody", "Anna", "Jaan", "Kati"])).toBe("Mark, Melody & 3 others");
    expect(namesTogether([])).toBe("");
  });
});

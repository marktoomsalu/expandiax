import { describe, expect, it } from "vitest";
import { whenOptions } from "./whenRange";

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
const pick = (iso: string, key: string) => whenOptions(at(iso)).find((w) => w.key === key);

describe("whenOptions", () => {
  it("knows today and tomorrow", () => {
    expect(pick("2026-11-10", "today")).toMatchObject({ from: "2026-11-10", until: "2026-11-10" });
    expect(pick("2026-11-10", "tomorrow")).toMatchObject({ from: "2026-11-11", until: "2026-11-11" });
  });

  it("finds the coming weekend, or the one you're in", () => {
    expect(pick("2026-11-10", "weekend")).toMatchObject({ from: "2026-11-14", until: "2026-11-15" }); // a Tuesday
    expect(pick("2026-11-14", "weekend")).toMatchObject({ from: "2026-11-14", until: "2026-11-15" }); // Saturday
    expect(pick("2026-11-15", "weekend")).toMatchObject({ from: "2026-11-15", until: "2026-11-15" }); // Sunday
  });

  it("names the next months, this one from today, a new year with its year", () => {
    const opts = whenOptions(at("2026-11-10"));
    expect(opts.find((w) => w.key === "2026-11")).toMatchObject({ label: "November", from: "2026-11-10", until: "2026-11-30" });
    expect(opts.find((w) => w.key === "2026-12")).toMatchObject({ label: "December", from: "2026-12-01", until: "2026-12-31" });
    expect(opts.find((w) => w.key === "2027-02")).toMatchObject({ label: "February 2027", until: "2027-02-28" });
  });
});

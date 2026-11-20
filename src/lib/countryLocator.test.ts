import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Topology } from "topojson-specification";
import { makeLocator, shapesFromTopology } from "./countryLocator";

const topology = JSON.parse(readFileSync(path.join(process.cwd(), "public", "data", "world-50m.json"), "utf-8")) as Topology;
const locate = makeLocator(shapesFromTopology(topology));

describe("countryLocator", () => {
  it.each([
    ["Tallinn old town", 59.437, 24.745, "EE"],
    ["Bologna", 44.494, 11.343, "IT"],
    ["Lisbon, Belém by the river", 38.6916, -9.2160, "PT"],
    ["Nazaré beach", 39.6012, -9.0756, "PT"],
    ["Zakynthos, Navagio beach", 37.8597, 20.6248, "GR"],
    ["Vatican, St Peter's", 41.9022, 12.4539, "VA"],
    ["San Marino", 43.9356, 12.4473, "SM"],
    ["Monaco harbour", 43.7347, 7.4206, "MC"],
    ["Singapore, Marina Bay", 1.2834, 103.8607, "SG"],
    ["Erg Chebbi, Merzouga", 31.15, -4.0, "MA"],
    ["Fiji, Suva", -18.1416, 178.4419, "FJ"],
    ["New York, Manhattan", 40.758, -73.9855, "US"],
    ["Valletta", 35.8989, 14.5146, "MT"],
  ])("%s", (_name, lat, lng, code) => {
    expect(locate(lat, lng)).toBe(code);
  });

  it("is nowhere in the middle of the ocean", () => {
    expect(locate(30, -40)).toBeNull();
  });
});

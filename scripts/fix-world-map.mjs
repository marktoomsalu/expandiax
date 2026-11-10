// Corrections to the world map data (public/data/world-110m.json, from
// world-atlas / Natural Earth), applied in place. Run again after ever
// replacing that file:
//
//   node scripts/fix-world-map.mjs
//
// 1. Crimea is Ukraine. Natural Earth's default map draws it as part of
//    Russia; here its polygon moves to Ukraine and is merged in (the shared
//    Perekop border dissolves, so no line runs across Ukraine).
//
// 2. Kosovo has no ISO number, so Natural Earth leaves its shape without an
//    id and the app can't colour it. It gets "XK", the same value as its
//    `numeric` in src/data/countries.json.
//
// (French Guiana, which the same data bundles with France, is split off at
// load time in WorldGlobeInner instead.)

import { readFileSync, writeFileSync } from "node:fs";
import { mergeArcs, feature } from "topojson-client";

const FILE = new URL("../public/data/world-110m.json", import.meta.url);
const RUSSIA = "643";
const UKRAINE = "804";

const topology = JSON.parse(readFileSync(FILE, "utf8"));
const geometries = topology.objects.countries.geometries;
const russia = geometries.find((g) => g.id === RUSSIA);
const ukraine = geometries.find((g) => g.id === UKRAINE);

// Russia's parts as coordinates, to find the one that is Crimea.
const ruFeature = feature(topology, { type: "GeometryCollection", geometries: [russia] }).features[0];
const isCrimea = (poly) => {
  const ring = poly[0];
  const lon = ring.reduce((a, p) => a + p[0], 0) / ring.length;
  const lat = ring.reduce((a, p) => a + p[1], 0) / ring.length;
  return lon > 32 && lon < 37 && lat > 44 && lat < 46.3;
};
const index = ruFeature.geometry.type === "MultiPolygon" ? ruFeature.geometry.coordinates.findIndex(isCrimea) : -1;
if (index === -1) {
  console.log("Crimea is already not part of Russia here.");
} else {
  const crimea = { type: "Polygon", arcs: russia.arcs[index] };
  russia.arcs = russia.arcs.filter((_, i) => i !== index);
  const merged = mergeArcs(topology, [ukraine, crimea]);
  Object.assign(ukraine, { type: merged.type, arcs: merged.arcs });
  console.log(`Moved Crimea (Russia's part ${index}) to Ukraine.`);
}

const kosovo = geometries.find((g) => g.properties?.name === "Kosovo");
if (kosovo && kosovo.id !== "XK") {
  kosovo.id = "XK";
  console.log("Gave Kosovo its id.");
}

writeFileSync(FILE, JSON.stringify(topology));

// Towns per country, for naming the places in your photos on your own
// device: public/data/places/XX.json = [[name, lat, lng, population], …],
// biggest first. From GeoNames' "cities1000" (every place of 1,000+ people),
// CC BY 4.0 — https://www.geonames.org. Re-run to refresh:
//   curl -O https://download.geonames.org/export/dump/cities1000.zip && unzip cities1000.zip
//   node scripts/build-place-data.mjs cities1000.txt
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const src = process.argv[2];
if (!src) throw new Error("usage: node scripts/build-place-data.mjs cities1000.txt");
// Neighbourhoods, and places that no longer exist, aren't where you were.
const SKIP = new Set(["PPLX", "PPLH", "PPLQ", "PPLW"]);
const byCountry = new Map();
for (const line of readFileSync(src, "utf8").split("\n")) {
  const f = line.split("\t");
  if (f.length < 15 || SKIP.has(f[7])) continue;
  const cc = f[8];
  if (!/^[A-Z]{2}$/.test(cc)) continue;
  const row = [f[1], Math.round(+f[4] * 1e4) / 1e4, Math.round(+f[5] * 1e4) / 1e4, +f[14] || 0];
  (byCountry.get(cc) ?? byCountry.set(cc, []).get(cc)).push(row);
}
const out = "public/data/places";
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const [cc, rows] of byCountry) {
  rows.sort((a, b) => b[3] - a[3]);
  writeFileSync(`${out}/${cc}.json`, JSON.stringify(rows));
}
console.log(`${byCountry.size} countries, ${[...byCountry.values()].reduce((n, r) => n + r.length, 0)} places`);

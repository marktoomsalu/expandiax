// Airport cities for flight prices, from Travelpayouts' public city list:
//   curl -o cities.json https://api.travelpayouts.com/data/en/cities.json
//   node scripts/build-flight-cities.mjs cities.json
// Writes src/data/flightCities.json:
//   gateways: country -> the city code to fly to (its capital's, or its main hub)
//   cities:   [code, lat, lng] for every city with scheduled flights — to find
//             the one nearest to where someone is
import { readFileSync, writeFileSync } from "node:fs";

const src = process.argv[2];
if (!src) throw new Error("usage: node scripts/build-flight-cities.mjs cities.json");
const cities = JSON.parse(readFileSync(src, "utf8")).filter((c) => c.has_flightable_airport && c.coordinates && /^[A-Z]{3}$/.test(c.code));
const countries = JSON.parse(readFileSync("src/data/countries.json", "utf8"));

// Where people actually fly to, when that isn't the capital (or the capital has no airport).
const HUB = {
  US: "NYC", CA: "YTO", AU: "SYD", NZ: "AKL", TR: "IST", CH: "ZRH", BR: "SAO", MA: "CMN", ZA: "JNB", NG: "LOS",
  TZ: "DAR", AE: "DXB", MM: "RGN", LK: "CMB", IL: "TLV", CY: "LCA", MT: "MLA", MC: "NCE", LI: "ZRH", SM: "RMI",
  VA: "ROM", CI: "ABJ", CM: "DLA", BZ: "BZE", BJ: "COO", BT: "PBH", BI: "BJM", SZ: "SHO", KI: "TRW", FM: "PNI",
  MN: "ULN", NR: "INU", PW: "ROR", VC: "SVD", TV: "FUN", YE: "SAH", DM: "DOM", MU: "MRU", SC: "SEZ", UG: "EBB",
  MV: "MLE", KZ: "ALA", VN: "SGN", BO: "LPB", EC: "UIO", PH: "MNL", ID: "JKT", IN: "DEL", CN: "BJS", JP: "TYO",
  GB: "LON", FR: "PAR", IT: "ROM", DE: "BER", RU: "MOW", SE: "STO", RO: "BUH", BE: "BRU", PT: "LIS", ST: "TMS",
};
const norm = (s) => (s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();

const gateways = {};
for (const k of countries) {
  const inCountry = cities.filter((c) => c.country_code === k.code);
  const capital = inCountry.find((c) => norm(c.name) === norm(k.capital));
  const code = HUB[k.code] ?? capital?.code;
  if (code) gateways[k.code] = code;
}

const round = (n) => Math.round(n * 100) / 100;
const out = { gateways, cities: cities.map((c) => [c.code, round(c.coordinates.lat), round(c.coordinates.lon)]) };
writeFileSync("src/data/flightCities.json", JSON.stringify(out));
console.log(`${Object.keys(gateways).length} of ${countries.length} countries have a gateway; ${out.cities.length} airport cities`);

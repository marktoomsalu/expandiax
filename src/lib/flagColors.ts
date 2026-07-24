import { CONTINENT_COLORS, countryByCode } from "./countries";

/**
 * Two representative flag colors per country, used as a gradient background
 * on share cards. Not pixel-precise pantone values — just the flag's two
 * most recognisable hues, picked for a good-looking gradient (white/near-white
 * is skipped in favour of the flag's more saturated tones).
 *
 * Not every country is curated here — anything missing falls back to its
 * continent's brand color paired with a darker shade of itself.
 */
const FLAG_COLORS: Record<string, [string, string]> = {
  // Europe
  EE: ["#0072CE", "#000000"],
  LV: ["#9E3039", "#FFFFFF"],
  LT: ["#FDB913", "#006A44"],
  FI: ["#003580", "#4A90D9"],
  SE: ["#006AA7", "#FECC02"],
  NO: ["#BA0C2F", "#00205B"],
  DK: ["#C60C30", "#FFFFFF"],
  IS: ["#003897", "#D72828"],
  GB: ["#C8102E", "#012169"],
  IE: ["#169B62", "#FF883E"],
  FR: ["#0055A4", "#EF4135"],
  DE: ["#DD0000", "#FFCE00"],
  NL: ["#AE1C28", "#21468B"],
  BE: ["#FDDA24", "#EF3340"],
  LU: ["#00A1DE", "#ED2939"],
  CH: ["#FF0000", "#FFFFFF"],
  AT: ["#ED2939", "#FFFFFF"],
  ES: ["#AA151B", "#F1BF00"],
  PT: ["#046A38", "#DA291C"],
  IT: ["#009246", "#CE2B37"],
  GR: ["#0D5EAF", "#FFFFFF"],
  PL: ["#DC143C", "#FFFFFF"],
  CZ: ["#11457E", "#D7141A"],
  SK: ["#0B4EA2", "#EE1C25"],
  HU: ["#CE2939", "#436F4D"],
  RO: ["#002B7F", "#FCD116"],
  BG: ["#00966E", "#D62612"],
  HR: ["#FF0000", "#0093DD"],
  SI: ["#005CE6", "#FFFFFF"],
  RS: ["#C6363C", "#0C4076"],
  UA: ["#0057B7", "#FFD700"],
  BY: ["#D22730", "#00AF66"],
  RU: ["#0039A6", "#D52B1E"],
  TR: ["#E30A17", "#FFFFFF"],
  GE: ["#FF0000", "#FFFFFF"],
  AM: ["#D90012", "#0033A0"],
  AZ: ["#00B9E4", "#EF3340"],
  MT: ["#CF142B", "#FFFFFF"],
  CY: ["#D57800", "#FFFFFF"],
  MC: ["#CE1126", "#FFFFFF"],
  AD: ["#0018A8", "#D50032"],
  LI: ["#002B7F", "#CE1126"],
  SM: ["#5EB6E4", "#FFFFFF"],

  // Americas
  US: ["#B31942", "#0A3161"],
  CA: ["#FF0000", "#FFFFFF"],
  MX: ["#006341", "#CE1126"],
  BR: ["#009739", "#FEDD00"],
  AR: ["#74ACDF", "#F6B40E"],
  CL: ["#D52B1E", "#0039A6"],
  PE: ["#D91023", "#FFFFFF"],
  CO: ["#FCD116", "#003893"],
  EC: ["#FFDD00", "#0072CE"],
  BO: ["#D52B1E", "#007934"],
  UY: ["#0038A8", "#FCD116"],
  PY: ["#0038A8", "#D52B1E"],
  VE: ["#FFCC00", "#00247D"],
  CR: ["#002B7F", "#CE1126"],
  PA: ["#DA121A", "#0072CE"],
  CU: ["#002A8F", "#CF142B"],
  DO: ["#002D62", "#CE1126"],
  JM: ["#009B3A", "#FED100"],
  BS: ["#00778B", "#FFC72C"],
  GT: ["#4997D0", "#FFFFFF"],

  // Asia
  JP: ["#BC002D", "#FFFFFF"],
  CN: ["#DE2910", "#FFDE00"],
  KR: ["#003478", "#C60C30"],
  TH: ["#A51931", "#2D2A4A"],
  VN: ["#DA251D", "#FFFF00"],
  ID: ["#FF0000", "#FFFFFF"],
  PH: ["#0038A8", "#CE1126"],
  MY: ["#010066", "#CC0001"],
  SG: ["#ED2939", "#FFFFFF"],
  IN: ["#FF9933", "#138808"],
  NP: ["#DC143C", "#003893"],
  LK: ["#FFB700", "#8D153A"],
  BD: ["#006A4E", "#F42A41"],
  PK: ["#01411C", "#FFFFFF"],
  MN: ["#C4272F", "#015197"],
  KZ: ["#00AFCA", "#FEC50C"],
  UZ: ["#0099B5", "#1EB53A"],
  AE: ["#00732F", "#FF0000"],
  SA: ["#006C35", "#FFFFFF"],
  QA: ["#8D1B3D", "#FFFFFF"],
  KW: ["#007A3D", "#CE1126"],
  BH: ["#CE1126", "#FFFFFF"],
  OM: ["#DB161B", "#008000"],
  JO: ["#000000", "#007A3D"],
  IL: ["#0038B8", "#FFFFFF"],
  LB: ["#ED1C24", "#00A651"],
  KH: ["#032EA1", "#E00025"],
  LA: ["#002868", "#CE1126"],
  MM: ["#FECB00", "#34B233"],
  TW: ["#FE0000", "#000095"],
  HK: ["#DE2910", "#FFFFFF"],

  // Africa
  MA: ["#C1272D", "#006233"],
  EG: ["#CE1126", "#000000"],
  TN: ["#E70013", "#FFFFFF"],
  DZ: ["#006233", "#D21034"],
  ZA: ["#007A4D", "#FFB612"],
  KE: ["#000000", "#BB0000"],
  TZ: ["#1EB53A", "#00A3DD"],
  ET: ["#078930", "#DA121A"],
  GH: ["#CE1126", "#FCD116"],
  NG: ["#008751", "#FFFFFF"],
  SN: ["#00853F", "#FDEF42"],
  NA: ["#003580", "#D21034"],
  BW: ["#75AADB", "#000000"],
  MU: ["#EA2839", "#1A206D"],
  SC: ["#003F87", "#D62828"],
  ZM: ["#198A00", "#DE2010"],
  ZW: ["#006400", "#FFD200"],
  UG: ["#000000", "#FCDC04"],
  RW: ["#00A1DE", "#FAD201"],
  CI: ["#F77F00", "#009E60"],
  CM: ["#007A5E", "#CE1126"],

  // Oceania
  AU: ["#00008B", "#FF0000"],
  NZ: ["#00247D", "#CC142B"],
  FJ: ["#68BFE5", "#CE1126"],
  PG: ["#000000", "#CE1126"],
  WS: ["#002B7F", "#CE1126"],
  TO: ["#C10000", "#FFFFFF"],
  VU: ["#D21034", "#009543"],
};

function darken(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const int = parseInt(m[1], 16);
  const r = Math.round(((int >> 16) & 255) * (1 - amount));
  const g = Math.round(((int >> 8) & 255) * (1 - amount));
  const b = Math.round((int & 255) * (1 - amount));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Two-stop gradient colors for a country's flag, with a continent-based fallback. */
export function flagGradientColors(code: string): [string, string] {
  const curated = FLAG_COLORS[code.toUpperCase()];
  if (curated) return curated;
  const continent = countryByCode(code)?.continent as keyof typeof CONTINENT_COLORS | undefined;
  const base = (continent && CONTINENT_COLORS[continent]) || "#ff6347";
  return [base, darken(base, 0.45)];
}

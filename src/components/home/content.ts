import { COUNTRIES, countryByCode } from "@/lib/countries";
import type { StockPhoto } from "@/lib/stockPhotos";

// What the homepage shows — shared by the live homepage and /home-preview.

export const EVERYTHING = [
  "Every country and territory you've been to",
  "Every concert, festival, match and trip",
  "15 photos & 8 videos for each of them",
  "Your places on a map, and a US States map",
  "See who you know has been where",
  "Your own accent colour",
];

// Maya's map — the example traveller below, so the map and her profile tell one story.
export const SAMPLE_CODES = [
  "CA", "US", "MX", "PE", "CL", "AR", "IS", "PT", "ES", "FR", "IT", "GR",
  "MA", "NA", "ZA", "TZ", "JO", "IN", "TH", "VN", "KR", "JP", "NZ",
];
export const SAMPLE_CONTINENTS = new Set(SAMPLE_CODES.map((c) => countryByCode(c)?.continent)).size;
export const SAMPLE_PCT = `${Math.round((SAMPLE_CODES.length / COUNTRIES.length) * 1000) / 10}%`;

// Example photos from Unsplash, hotlinked and credited like the country photos in the app.
const UTM = "utm_source=expandiax&utm_medium=referral";
const unsplash = (id: string, raw: string, color: string, alt: string, author: string, username: string, slug: string): StockPhoto => ({
  id,
  raw,
  color,
  alt,
  author,
  authorUrl: `https://unsplash.com/@${username}?${UTM}`,
  photoUrl: `https://unsplash.com/photos/${slug}?${UTM}`,
  unsplashUrl: `https://unsplash.com/?${UTM}`,
});
export const DEADVLEI = unsplash(
  "M6xllhci484",
  "https://images.unsplash.com/photo-1597342809356-6dc1115906c1?ixlib=rb-4.1.0",
  "#0c2673",
  "A lone dead acacia on the white clay of Deadvlei, red dunes and deep blue sky behind",
  "Sean Robertson",
  "knuknuk",
  "bare-tree-on-desert-during-daytime-M6xllhci484"
);
export const NEON_NIGHT = unsplash(
  "r3XvSBEQQLo",
  "https://images.unsplash.com/photo-1574155376612-bfa4ed8aabfd?ixlib=rb-4.1.0",
  "#260c0c",
  "A crowd with hands up under pink laser beams at a concert",
  "A J.",
  "antoinejulien",
  "group-of-people-enjoying-concert-r3XvSBEQQLo"
);

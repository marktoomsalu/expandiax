// The Year Wrapped finale, as one picture for Instagram Stories (1080×1920):
// the drawing is PosterArt (shared with the phone's live collage); here its
// photos, fonts, logo and globe are fetched and it becomes a PNG.

import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { ImageResponse } from "next/og";
import type { Topology } from "topojson-specification";
import { drawGlobe, worldFeatures, type WorldFeature } from "@/lib/globeArt";
import { collageDefault, type WrappedYear } from "@/lib/wrapped";
import { AROUND, BORDER, COLLAGE_SLOTS, inside, MAIN, POSTER_GLOBE, POSTER_H, POSTER_W, PosterArt, storyFacts } from "@/lib/wrappedPosterArt";

const fontCache = new Map<string, Promise<ArrayBuffer | null>>();
function loadFont(query: string): Promise<ArrayBuffer | null> {
  let p = fontCache.get(query);
  if (!p) {
    p = (async () => {
      try {
        const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${query}`)).text();
        const url = /src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/.exec(css)?.[1];
        return url ? await (await fetch(url)).arrayBuffer() : null;
      } catch {
        return null;
      }
    })();
    fontCache.set(query, p);
  }
  return p;
}

let logo: Promise<string> | null = null;
const loadLogo = () => (logo ??= readFile(path.join(process.cwd(), "public", "wordmark.svg")).then((b) => `data:image/svg+xml;base64,${b.toString("base64")}`));

let world: Promise<WorldFeature[]> | null = null;
const loadWorld = () => (world ??= readFile(path.join(process.cwd(), "public", "data", "world-110m.json"), "utf8").then((raw) => worldFeatures(JSON.parse(raw) as Topology)));

async function photoData(url: string | null | undefined, w: number, h: number): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const out = await sharp(Buffer.from(await res.arrayBuffer())).rotate().resize(w, h, { fit: "cover" }).jpeg({ quality: 84 }).toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * The Story picture with these photos (the big one first, then up to four
 * around it). None chosen: a mix from across their year (collageDefault).
 */
export async function renderWrappedPoster(w: WrappedYear, photoIds: string[]): Promise<ImageResponse> {
  const known = photoIds.filter((id) => w.photos.some((p) => p.id === id));
  const ids = (known.length ? known : collageDefault(w)).slice(0, COLLAGE_SLOTS);
  const urls = ids.map((id) => w.photos.find((p) => p.id === id)?.url ?? null);
  // Not one photo of their own: their top highlight's picture (a concert's, say), if there is one.
  if (!urls.length && w.highlights[0]?.photo) urls.push(w.highlights[0].photo);

  // Each photo cut to exactly the inside of its frame (twice the size, for sharpness).
  const sizes = [inside(MAIN, BORDER.main), ...AROUND.map((b) => inside(b, BORDER.around))];
  const photos = await Promise.all(urls.map((u, i) => photoData(u, sizes[i][0] * 2, sizes[i][1] * 2)));
  const [titleFont, inter, interSemi, interBold, wordmark, features] = await Promise.all([
    loadFont("Fraunces:ital,opsz,wght@1,72,700"),
    loadFont("Inter:wght@400"),
    loadFont("Inter:wght@600"),
    loadFont("Inter:wght@700"),
    loadLogo(),
    loadWorld(),
  ]);
  const fonts = [
    titleFont && { name: "Fraunces", data: titleFont, weight: 700 as const, style: "italic" as const },
    inter && { name: "Inter", data: inter, weight: 400 as const, style: "normal" as const },
    interSemi && { name: "Inter", data: interSemi, weight: 600 as const, style: "normal" as const },
    interBold && { name: "Inter", data: interBold, weight: 700 as const, style: "normal" as const },
  ].filter((f): f is NonNullable<typeof f> => !!f);

  const globe = drawGlobe(features, { ...POSTER_GLOBE, countries: w.countries, home: w.homeCode, route: w.journey.map((s) => s.code) });

  return new ImageResponse(<PosterArt year={w.year} facts={storyFacts(w)} photos={photos} globe={globe} wordmark={wordmark} />, {
    width: POSTER_W,
    height: POSTER_H,
    fonts: fonts.length ? fonts : undefined,
    headers: { "Cache-Control": "private, max-age=600" },
  });
}

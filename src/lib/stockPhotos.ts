import photos from "@/data/countryPhotos.json";

// A beautiful photo for a country someone has been to but hasn't added
// their own photos of yet — hand-picked from Unsplash (see
// src/data/countryPhotos.json). Shown with a credit and an "add yours"
// prompt, never passed off as the person's own, and replaced everywhere
// the moment they upload one. Images are hotlinked from Unsplash, as its
// API guidelines require.

type Entry = { id: string; raw: string; color: string; alt: string; author: string; username: string; html: string };

export type StockPhoto = {
  id: string;
  src: string; // ~1200px wide
  srcSmall: string; // ~640px wide
  color: string; // average colour, shown while it loads
  alt: string;
  author: string;
  authorUrl: string;
  photoUrl: string;
  unsplashUrl: string;
};

const UTM = "utm_source=expandiax&utm_medium=referral";
const sized = (raw: string, w: number) => `${raw}${raw.includes("?") ? "&" : "?"}w=${w}&q=75&fm=jpg&fit=crop&auto=format`;

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** The stock photo for a country — the same one for the same person every time. */
export function stockPhotoFor(countryCode: string | null | undefined, seed = ""): StockPhoto | null {
  const list = (photos as Record<string, Entry[]>)[(countryCode ?? "").toUpperCase()];
  if (!list?.length) return null;
  const p = list[hash(`${seed}:${countryCode}`) % list.length];
  return {
    id: p.id,
    src: sized(p.raw, 1200),
    srcSmall: sized(p.raw, 640),
    color: p.color,
    alt: p.alt || `A view of ${countryCode}`,
    author: p.author,
    authorUrl: `https://unsplash.com/@${p.username}?${UTM}`,
    photoUrl: `${p.html}?${UTM}`,
    unsplashUrl: `https://unsplash.com/?${UTM}`,
  };
}

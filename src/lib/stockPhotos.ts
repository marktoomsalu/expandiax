import photos from "@/data/countryPhotos.json";
import eventPhotos from "@/data/eventPhotos.json";

// A beautiful photo for a country someone has been to but hasn't added
// their own photos of yet — hand-picked from Unsplash (see
// src/data/countryPhotos.json). Shown with a credit and an "add yours"
// prompt, never passed off as the person's own, and replaced everywhere
// the moment they upload one. Images are hotlinked from Unsplash, as its
// API guidelines require.

type Entry = { id: string; raw: string; color: string; alt: string; author: string; username: string; html: string };

export type StockPhoto = {
  id: string;
  raw: string; // Unsplash's resizable original — see StockImage
  color: string; // average colour, shown while it loads
  alt: string;
  author: string;
  authorUrl: string;
  photoUrl: string;
  unsplashUrl: string;
};

const UTM = "utm_source=expandiax&utm_medium=referral";

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
    raw: p.raw,
    color: p.color,
    alt: p.alt || `A view of ${countryCode}`,
    author: p.author,
    authorUrl: `https://unsplash.com/@${p.username}?${UTM}`,
    photoUrl: `${p.html}?${UTM}`,
    unsplashUrl: `https://unsplash.com/?${UTM}`,
  };
}

/**
 * An Unsplash image URL at a given width — and, with `aspect` ("3:4"),
 * cropped by Unsplash to exactly that shape (around the most detailed part
 * of the photo), so a tall card gets a tall, full-resolution image instead
 * of a small landscape one stretched to fill it.
 */
export function stockUrl(raw: string, width: number, aspect?: string, quality = 80): string {
  const params = new URLSearchParams({ w: String(width), q: String(quality), auto: "format" });
  if (aspect) {
    params.set("ar", aspect);
    params.set("fit", "crop");
    params.set("crop", "entropy");
  }
  return `${raw}${raw.includes("?") ? "&" : "?"}${params}`;
}

// ---------------------------------------------------------------- events


export type EventPhotoKind = "concert" | "festival" | "sport" | "race" | "conference" | "wedding" | "party" | "other";

/** A photo for a kind of event (a concert crowd, a packed stadium), hand-picked from Unsplash, the same for the same seed. */
export function eventStockPhoto(kind: EventPhotoKind, seed = ""): StockPhoto | null {
  const list = (eventPhotos as Record<string, Entry[]>)[kind] ?? (eventPhotos as Record<string, Entry[]>).other;
  if (!list?.length) return null;
  const p = list[hash(`${seed}:${kind}`) % list.length];
  return {
    id: p.id,
    raw: p.raw,
    color: p.color,
    alt: p.alt,
    author: p.author,
    authorUrl: `https://unsplash.com/@${p.username}?${UTM}`,
    photoUrl: `${p.html}?${UTM}`,
    unsplashUrl: `https://unsplash.com/?${UTM}`,
  };
}

/** Which kind of photo an event gets: a race by its name, otherwise its type. */
export function eventPhotoKind(type: string, title = ""): EventPhotoKind {
  if (type === "sport" && /marathon|ironman|triathlon|\brun\b|race|half/i.test(title)) return "race";
  if (type === "personal") return /wedding/i.test(title) ? "wedding" : "party";
  return (["concert", "festival", "sport", "conference"] as const).includes(type as never) ? (type as EventPhotoKind) : "other";
}

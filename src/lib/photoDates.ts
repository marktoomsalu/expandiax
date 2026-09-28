// When photos were taken, read on the person's own device from the photo
// file (EXIF), to suggest a trip's or event's dates. Nothing is stored or
// sent — and location/camera details are stripped before upload anyway.

/** yyyy-mm-dd in the photo's own local time (EXIF times have no time zone). */
export function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The first and last day among these, ignoring dates that can't be right. */
export function rangeOf(days: string[], today = localDay(new Date())): { from: string; to: string; count: number } | null {
  const ok = days.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= "1990-01-01" && d <= today).sort();
  return ok.length ? { from: ok[0], to: ok[ok.length - 1], count: ok.length } : null;
}

/** The day a photo was taken, or null (no EXIF, not a photo, etc.). */
export async function photoDay(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const exifr = await import("exifr");
    // Raw bytes rather than the File itself: works in every browser and web view.
    const tags = await exifr.parse(await file.arrayBuffer(), ["DateTimeOriginal", "CreateDate"]);
    const date = tags?.DateTimeOriginal ?? tags?.CreateDate;
    return date instanceof Date && !Number.isNaN(date.getTime()) ? localDay(date) : null;
  } catch {
    return null;
  }
}

/** First and last day across these photos. */
export async function photoDateRange(files: File[]) {
  const days = await Promise.all(files.map(photoDay));
  return rangeOf(days.filter((d): d is string => !!d));
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "7 September 2026", "7–8 September 2026", "30 Aug – 2 Sep 2025", "30 Dec 2025 – 2 Jan 2026". */
export function describeDays(from: string, to: string): string {
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  const short = (m: number) => MONTHS[m - 1].slice(0, 3);
  if (from === to) return `${ad} ${MONTHS[am - 1]} ${ay}`;
  if (ay === by && am === bm) return `${ad}–${bd} ${MONTHS[am - 1]} ${ay}`;
  if (ay === by) return `${ad} ${short(am)} – ${bd} ${short(bm)} ${ay}`;
  return `${ad} ${short(am)} ${ay} – ${bd} ${short(bm)} ${by}`;
}

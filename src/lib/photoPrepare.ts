import { stripImageMetadata } from "@/lib/mediaMetadata";

// Photos are made ready on the person's own device before they upload:
// shrunk to a size that still looks sharp full-screen (a 6 MB original
// becomes ~0.5 MB — a tenth of the wait, and pages load faster after), and
// redrawn, which also leaves every bit of location/camera metadata behind.

export const MAX_EDGE = 2560;
const QUALITY = 0.85;

/** The size to draw at: the longest side at most `max`, never enlarged. */
export function fitWithin(w: number, h: number, max = MAX_EDGE): { w: number; h: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

/** A photo as the browser shows it — turned the right way up from its EXIF orientation. */
async function decode(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // The decoded image stays usable after its URL is released.
    URL.revokeObjectURL(url);
  }
}

/**
 * The photo to upload: shrunk and without metadata. Falls back to the
 * original with its metadata stripped when the browser can't redraw it,
 * and keeps GIFs as they are (they may move, and carry no location).
 */
export async function preparePhoto(file: File): Promise<File> {
  if (file.type === "image/gif" || typeof document === "undefined") return stripImageMetadata(file);
  try {
    const img = await decode(file);
    const { w, h } = fitWithin(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    // Transparent PNGs become JPEGs — white rather than black behind them.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob) throw new Error("no blob");
    // Already small and not resized: the original (cleaned) is the better copy.
    if (blob.size >= file.size && w === img.naturalWidth) return stripImageMetadata(file);
    return new File([blob], file.name.replace(/\.[^./]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return stripImageMetadata(file);
  }
}

// ---------- The cover: the best landscape photo ----------

export type PhotoLook = { w: number; h: number; sharpness: number; brightness: number };

/**
 * How good a photo is as a trip's or event's cover: landscape first (covers
 * are wide), then sharp (not a blurry shot), then well lit (not a dark
 * pocket photo or a blown-out sky). Screenshots-sized tiny images lose.
 */
export function coverScore(p: PhotoLook): number {
  const ratio = p.w / p.h;
  const shape = ratio >= 1.2 ? 1 : ratio >= 1 ? 0.55 : 0.2;
  const size = Math.max(p.w, p.h) >= 1000 ? 1 : 0.5;
  const sharp = Math.min(1, p.sharpness / 600);
  const light = 1 - Math.min(1, Math.abs(p.brightness - 0.47) / 0.47);
  return shape * size * (0.25 + 0.45 * sharp + 0.3 * light);
}

/** Sharpness (variance of the Laplacian) and brightness (0–1) of a small grey copy. */
export function measure(gray: Float32Array, w: number, h: number): { sharpness: number; brightness: number } {
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  let lapSum = 0;
  let lapSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      lapSum += lap;
      lapSq += lap * lap;
      n++;
    }
  }
  const mean = n ? lapSum / n : 0;
  return { sharpness: n ? lapSq / n - mean * mean : 0, brightness: gray.length ? sum / gray.length / 255 : 0 };
}

async function look(file: File): Promise<PhotoLook | null> {
  try {
    const img = await decode(file);
    const { w, h } = fitWithin(img.naturalWidth, img.naturalHeight, 256);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const gray = new Float32Array(w * h);
    for (let i = 0; i < gray.length; i++) gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    return { w: img.naturalWidth, h: img.naturalHeight, ...measure(gray, w, h) };
  } catch {
    return null;
  }
}

/** Which of these photos makes the best cover — its index, or -1 if none can be read. */
export async function pickCover(files: File[]): Promise<number> {
  let best = -1;
  let bestScore = -1;
  // Enough to find a good one without keeping someone waiting on a big batch.
  for (let i = 0; i < Math.min(files.length, 40); i++) {
    if (!files[i].type.startsWith("image/")) continue;
    const l = await look(files[i]);
    if (!l) continue;
    const s = coverScore(l);
    if (s > bestScore) {
      best = i;
      bestScore = s;
    }
  }
  return best;
}

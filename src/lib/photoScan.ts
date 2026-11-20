import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { ScanPlace } from "./tripFinder";

// The iPhone app's photo scanner (ios/App/App/PhotoScanPlugin.swift, from
// build 12): when and where photos were taken, read on the phone. Older
// builds, the web and Android don't have it, and the flow isn't offered there.

export type PhotoAccess = "full" | "limited" | "denied" | "restricted" | "ask";

interface PhotoScanNative {
  access(): Promise<{ status: PhotoAccess }>;
  requestAccess(): Promise<{ status: PhotoAccess }>;
  openSettings(): Promise<void>;
  chooseMore(): Promise<void>;
  scan(): Promise<{ total: number; located: number; places: ScanPlace[] }>;
  images(options: { ids: string[]; size: number; quality?: number }): Promise<{ images: Record<string, string> }>;
  addListener(event: "progress", fn: (e: { done: number; total: number; located: number }) => void): Promise<PluginListenerHandle>;
}

const Native = registerPlugin<PhotoScanNative>("PhotoScan");

export const canScanPhotos = () => Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("PhotoScan");

export const photoAccess = () => Native.access().then((r) => r.status);
export const askPhotoAccess = () => Native.requestAccess().then((r) => r.status);
export const openAppSettings = () => Native.openSettings();
export const chooseMorePhotos = () => Native.chooseMore();

export async function scanPhotos(onProgress: (p: { done: number; total: number; located: number }) => void) {
  const handle = await Native.addListener("progress", onProgress);
  try {
    return await Native.scan();
  } finally {
    await handle.remove();
  }
}

// Pictures made on the phone, kept for the session so cards don't flicker
// when they come back into view.
const cache = new Map<string, string>();
const waiting = new Map<string, Promise<string | null>>();

/** Small pictures of photos, as data URLs (missing ones left out). */
export async function photoThumbs(ids: string[], size = 720): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const need: string[] = [];
  for (const id of ids) {
    const key = `${size}:${id}`;
    const hit = cache.get(key);
    if (hit) out[id] = hit;
    else if (!waiting.has(key)) need.push(id);
  }
  if (need.length) {
    const request = Native.images({ ids: need, size, quality: 0.78 }).then((r) => r.images);
    for (const id of need) {
      const key = `${size}:${id}`;
      waiting.set(
        key,
        request
          .then((imgs) => {
            const url = imgs[id] ? `data:image/jpeg;base64,${imgs[id]}` : null;
            if (url) cache.set(key, url);
            return url;
          })
          .catch(() => null)
          .finally(() => waiting.delete(key))
      );
    }
  }
  await Promise.all(
    ids.map(async (id) => {
      if (out[id]) return;
      const key = `${size}:${id}`;
      const url = cache.get(key) ?? (await waiting.get(key)) ?? null;
      if (url) {
        cache.set(key, url);
        out[id] = url;
      }
    })
  );
  return out;
}

/** A photo at upload size, as a File (JPEG without location or camera data). */
export async function photoFile(id: string, size = 2560): Promise<File | null> {
  try {
    const { images } = await Native.images({ ids: [id], size, quality: 0.85 });
    const b64 = images[id];
    if (!b64) return null;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes as BlobPart], `trip-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return null;
  }
}

import { useEffect, useState } from "react";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

// The iPhone app's own photo picker (ios/App/App/PhotoPickerPlugin.swift):
// it closes the moment ✓ is tapped, and the photos follow, downloaded from
// iCloud in the background and shrunk to upload size on the phone. Only in
// app builds that have it (from build 10); elsewhere the page's file input.

interface PhotoPickerNative {
  pick(options: { limit: number; videos?: boolean; videoQuality?: "standard" | "hd" }): Promise<{ items: { id: string }[] }>;
  features(): Promise<{ videos?: boolean }>;
  addListener(event: "progress", fn: (e: { id: string; fraction: number }) => void): Promise<PluginListenerHandle>;
  addListener(event: "chunk", fn: (e: { id: string; index: number; data: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: "loaded", fn: (e: { id: string; name: string; data?: string; type?: string; chunked?: boolean; chunks?: number }) => void): Promise<PluginListenerHandle>;
  addListener(event: "failed", fn: (e: { id: string; message: string }) => void): Promise<PluginListenerHandle>;
}

const Native = registerPlugin<PhotoPickerNative>("PhotoPicker");

export const hasNativePhotoPicker = () => Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("PhotoPicker");

export type PickProgress = { total: number; done: number; fraction: number };

let videoSupport: Promise<boolean> | null = null;
/** Whether this app build's picker can also pick videos (build 11 on); older ones only do photos. */
export function nativePickerTakesVideos(): Promise<boolean> {
  if (!hasNativePhotoPicker()) return Promise.resolve(false);
  videoSupport ??= Native.features()
    .then((f) => !!f.videos)
    .catch(() => false);
  return videoSupport;
}

function bytesOf(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function toFile(name: string, base64: string): File {
  return new File([bytesOf(base64) as BlobPart], name, { type: "image/jpeg", lastModified: Date.now() });
}

/**
 * Pick photos with the native picker. `onPicked` fires as soon as the
 * picker closes (with how many were chosen); the returned promise resolves
 * with the photos once they've all arrived (failed ones left out).
 */
export async function pickNativePhotos(
  limit: number,
  onPicked: (count: number) => void,
  onProgress: (p: PickProgress) => void,
  /** Videos too (only for builds whose picker takes them: nativePickerTakesVideos). */
  opts: { videos?: boolean; videoQuality?: "standard" | "hd" } = {}
): Promise<{ files: File[]; failed: number }> {
  const fractions = new Map<string, number>();
  // A video arrives in pieces, in order, then "loaded" says it's all there.
  const parts = new Map<string, BlobPart[]>();
  const files = new Map<string, File>();
  const failed = new Set<string>();
  let ids: string[] | null = null;
  let finish: () => void = () => {};
  const finished = new Promise<void>((r) => (finish = r));

  const report = () => {
    if (!ids) return;
    const done = ids.filter((id) => files.has(id) || failed.has(id)).length;
    const fraction = ids.reduce((sum, id) => sum + (files.has(id) || failed.has(id) ? 1 : fractions.get(id) ?? 0), 0) / Math.max(1, ids.length);
    onProgress({ total: ids.length, done, fraction });
    if (done === ids.length) finish();
  };

  const handles = await Promise.all([
    Native.addListener("progress", ({ id, fraction }) => {
      fractions.set(id, fraction);
      report();
    }),
    Native.addListener("chunk", ({ id, data }) => {
      const list = parts.get(id) ?? [];
      list.push(bytesOf(data) as BlobPart);
      parts.set(id, list);
    }),
    Native.addListener("loaded", ({ id, name, data, type, chunked }) => {
      if (chunked) {
        files.set(id, new File(parts.get(id) ?? [], name, { type: type ?? "video/mp4", lastModified: Date.now() }));
        parts.delete(id);
      } else if (data) {
        files.set(id, toFile(name, data));
      }
      report();
    }),
    Native.addListener("failed", ({ id }) => {
      failed.add(id);
      report();
    }),
  ]);
  try {
    const { items } = await Native.pick({ limit, ...(opts.videos ? { videos: true, videoQuality: opts.videoQuality ?? "standard" } : {}) });
    ids = items.map((i) => i.id);
    onPicked(ids.length);
    if (!ids.length) return { files: [], failed: 0 };
    report();
    await finished;
    // In the order they were chosen.
    return { files: ids.flatMap((id) => (files.has(id) ? [files.get(id)!] : [])), failed: failed.size };
  } finally {
    await Promise.all(handles.map((h) => h.remove()));
  }
}

/** For components: whether the app's picker takes videos too (false until known, and on the web). */
export function useNativePickerVideos(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let live = true;
    void nativePickerTakesVideos().then((v) => live && setOk(v));
    return () => {
      live = false;
    };
  }, []);
  return ok;
}

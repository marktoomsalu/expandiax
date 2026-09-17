import type { createClient } from "@/lib/supabase/client";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024; // 300 MB

export function classifyFile(file: File): "image" | "video" | null {
  if (IMAGE_TYPES.includes(file.type)) return "image";
  if (VIDEO_TYPES.includes(file.type)) return "video";
  return null;
}

// CSS object-position for a cover-photo crop — a single focal point, not a
// full crop box. Plain center is the safe default: a top-bias guess was
// tried and made things worse — it systematically cut people out of the
// gentler 4:3 feed crop (anyone whose head isn't right at the top of the
// photo loses their body). Reposition exists precisely so a specific bad
// crop can be fixed by hand; the default itself shouldn't gamble on a
// direction that only helps one particular aspect ratio.
export function focalPosition(item: { focal_x: number | null; focal_y: number | null }): string {
  if (item.focal_x == null || item.focal_y == null) return "50% 50%";
  return `${item.focal_x}% ${item.focal_y}%`;
}

export function validateFile(file: File, kind: "image" | "video"): string | null {
  if (kind === "image") {
    if (!IMAGE_TYPES.includes(file.type))
      return `“${file.name}” is not a supported image. Use JPEG, PNG, WebP, AVIF or GIF.`;
    if (file.size > MAX_IMAGE_BYTES)
      return `“${file.name}” is ${(file.size / 1048576).toFixed(1)} MB. Images can be up to 10 MB.`;
  } else {
    if (!VIDEO_TYPES.includes(file.type))
      return `“${file.name}” is not a supported video. Use MP4, WebM or MOV.`;
    if (file.size > MAX_VIDEO_BYTES)
      return `“${file.name}” is ${(file.size / 1048576).toFixed(0)} MB. Videos can be up to 300 MB.`;
  }
  return null;
}

export function storagePath(userId: string, scope: "countries" | "events", parentId: string, file: File) {
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "bin";
  const id = crypto.randomUUID();
  return `${userId}/${scope}/${parentId}/${id}.${ext}`;
}

// Upload one photo or video for a create-time "quick add" flow — compresses
// video (matching MediaUploader.tsx's saveAll(), extracted from there since
// MediaUploader itself is left untouched, see media-in-create-flow plan),
// uploads (resumable for video, plain for images), then inserts the row.
// Best-effort by convention: a failure here shouldn't block the record that
// was already created, so callers should swallow the error rather than
// treat it as fatal.
export async function uploadMediaItem(
  supabase: ReturnType<typeof createClient>,
  opts: {
    userId: string;
    scope: "countries" | "events";
    parentId: string;
    file: File;
    kind: "image" | "video";
    table: "event_media" | "country_media";
    extraFields: Record<string, string>;
    displayOrder?: number;
    videoQuality?: "standard" | "hd";
    onProgress?: (pct: number, phase: "compressing" | "uploading") => void;
  }
): Promise<{ error?: string }> {
  let fileToUpload = opts.file;

  if (opts.kind === "video" && (opts.videoQuality ?? "standard") === "standard") {
    try {
      const { compressVideo } = await import("./videoCompress");
      fileToUpload = await compressVideo(opts.file, (pct) => opts.onProgress?.(pct, "compressing"));
    } catch {
      // Compression can fail on unusual codecs or low-memory devices — fall back to the original file.
      fileToUpload = opts.file;
    }
  }

  const path = storagePath(opts.userId, opts.scope, opts.parentId, fileToUpload);

  if (opts.kind === "video") {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return { error: "You need to be signed in to upload." };
    try {
      const { uploadResumable } = await import("./resumableUpload");
      await uploadResumable(path, fileToUpload, token, (pct) => opts.onProgress?.(pct, "uploading"));
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Upload failed." };
    }
  } else {
    opts.onProgress?.(0, "uploading");
    const { error: uploadError } = await supabase.storage.from("media").upload(path, fileToUpload);
    if (uploadError) return { error: uploadError.message };
    opts.onProgress?.(100, "uploading");
  }

  const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
  const { error: insertError } = await supabase.from(opts.table).insert({
    storage_path: path,
    public_url: pub.publicUrl,
    media_type: opts.kind,
    display_order: opts.displayOrder ?? 0,
    ...opts.extraFields,
  });
  if (insertError) {
    await supabase.storage.from("media").remove([path]);
    return { error: insertError.message };
  }
  return {};
}

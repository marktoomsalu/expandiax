import type { createClient } from "@/lib/supabase/client";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024; // 300 MB

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

// Single quiet photo upload for a quick-add flow — no progress bar (unlike
// MediaUploader's XHR-based one), best-effort like FlushOnboardingDraft's
// flushMemory: a failure here shouldn't block the record that was already
// created, so callers should swallow the error rather than treat it as fatal.
export async function uploadSingleMedia(
  supabase: ReturnType<typeof createClient>,
  opts: {
    userId: string;
    scope: "countries" | "events";
    parentId: string;
    file: File;
    table: "event_media" | "country_media";
    extraFields: Record<string, string>;
  }
): Promise<{ error?: string }> {
  const path = storagePath(opts.userId, opts.scope, opts.parentId, opts.file);
  const { error: uploadError } = await supabase.storage.from("media").upload(path, opts.file);
  if (uploadError) return { error: uploadError.message };
  const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
  const { error: insertError } = await supabase.from(opts.table).insert({
    storage_path: path,
    public_url: pub.publicUrl,
    media_type: "image",
    display_order: 0,
    ...opts.extraFields,
  });
  return insertError ? { error: insertError.message } : {};
}

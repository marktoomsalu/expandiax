
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

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

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
      return `“${file.name}” is ${(file.size / 1048576).toFixed(0)} MB. Videos can be up to 100 MB.`;
  }
  return null;
}

export function storagePath(userId: string, scope: "countries" | "concerts", parentId: string, file: File) {
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "bin";
  const id = crypto.randomUUID();
  return `${userId}/${scope}/${parentId}/${id}.${ext}`;
}

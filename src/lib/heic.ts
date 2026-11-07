import { MAX_IMAGE_BYTES } from "@/lib/media";
import { preparePhoto } from "@/lib/photoPrepare";

// iPhones save photos as HEIC, which only Safari can open — Chrome and
// Firefox can neither show nor redraw them. So a HEIC photo becomes a JPEG
// the moment it's picked, right in the browser (the converter is a few MB
// and only loads when a HEIC photo turns up). The JPEG carries no EXIF, so
// the original stays alongside it for reading when and where it was taken.

const originals = new WeakMap<File, File>();

export function looksLikeHeic(file: File): boolean {
  return /^image\/hei[cf](-sequence)?$/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

/** The file to read a photo's date and location from: the original HEIC behind a converted photo, else the file itself. */
export function metadataSource(file: File): File {
  return originals.get(file) ?? file;
}

/** The picked files with every HEIC photo turned into a JPEG (others untouched), and the names of any that couldn't be read. */
export async function convertHeic(files: File[]): Promise<{ files: File[]; failed: string[] }> {
  if (!files.some(looksLikeHeic)) return { files, failed: [] };
  const { heicTo } = await import("heic-to");
  const out: File[] = [];
  const failed: string[] = [];
  for (const file of files) {
    if (!looksLikeHeic(file)) {
      out.push(file);
      continue;
    }
    try {
      const blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
      let jpeg = new File([blob], file.name.replace(/\.[^./]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
      // A 48 MP photo can come out over the upload limit as a full-size JPEG:
      // shrink that one now (every photo is shrunk on upload anyway).
      if (jpeg.size > MAX_IMAGE_BYTES) jpeg = await preparePhoto(jpeg);
      originals.set(jpeg, file);
      out.push(jpeg);
    } catch {
      failed.push(file.name);
    }
  }
  return { files: out, failed };
}

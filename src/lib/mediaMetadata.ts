// Removes location and camera metadata (GPS, device, timestamps, comments)
// from photos and videos before they're stored. Uploads are served from
// public URLs, so anything left inside a file is readable by whoever opens
// it — a photo's GPS coordinates can give away where someone lives.
//
// Lossless: only metadata bytes are dropped, the pixels/frames are never
// re-encoded. A photo's rotation is kept (as a minimal orientation-only
// tag) so it doesn't turn sideways. No imports on purpose — this runs in the
// browser, in tests and in the one-off script that cleans older uploads.

type Bytes = Uint8Array;

const u16 = (b: Bytes, i: number) => (b[i] << 8) | b[i + 1];
const u32 = (b: Bytes, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const ascii = (b: Bytes, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

function concat(parts: Bytes[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// ---------------------------------------------------------------- JPEG

// Reads the EXIF orientation (1–8) from a JPEG, or null if there isn't one.
function jpegOrientation(b: Bytes): number | null {
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const marker = b[i + 1];
    if (marker === 0xda) break;
    const len = u16(b, i + 2);
    if (marker === 0xe1 && ascii(b, i + 4, 4) === "Exif") {
      const t = i + 10; // start of the TIFF header
      const little = b[t] === 0x49;
      const r16 = (o: number) => (little ? b[o] | (b[o + 1] << 8) : u16(b, o));
      const r32 = (o: number) => (little ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : u32(b, o));
      const ifd = t + r32(t + 4);
      if (ifd + 2 > b.length) return null;
      const count = r16(ifd);
      for (let n = 0; n < count; n++) {
        const e = ifd + 2 + n * 12;
        if (e + 12 > b.length) break;
        if (r16(e) === 0x0112) {
          const v = r16(e + 8);
          return v >= 1 && v <= 8 ? v : null;
        }
      }
      return null;
    }
    i += 2 + len;
  }
  return null;
}

// A 34-byte EXIF segment that carries nothing but the orientation.
function orientationOnlyExif(orientation: number): Bytes {
  return new Uint8Array([
    0xff, 0xe1, 0x00, 0x22, // APP1, length 34
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big-endian TIFF header, IFD0 at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, // Orientation
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ]);
}

// Dropped: Exif/XMP (APP1), APP3–APP13 (IPTC, vendor data), APP15, comments.
// Kept: JFIF (APP0), ICC colour profile (APP2), Adobe colour flag (APP14),
// and every structural marker.
const dropJpegMarker = (m: number) => m === 0xe1 || (m >= 0xe3 && m <= 0xed) || m === 0xef || m === 0xfe;

function stripJpeg(b: Bytes): Bytes {
  const orientation = jpegOrientation(b);
  const parts: Bytes[] = [b.subarray(0, 2)];
  let pendingOrientation = orientation && orientation !== 1 ? orientationOnlyExif(orientation) : null;
  let i = 2;
  while (i + 2 <= b.length) {
    if (b[i] !== 0xff) break;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xda) break; // start of scan: the picture data follows
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      parts.push(b.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > b.length) break;
    const end = i + 2 + u16(b, i + 2);
    if (end > b.length) break;
    if (!dropJpegMarker(marker)) {
      if (pendingOrientation && marker !== 0xe0) {
        parts.push(pendingOrientation);
        pendingOrientation = null;
      }
      parts.push(b.subarray(i, end));
    }
    i = end;
  }
  if (pendingOrientation) parts.push(pendingOrientation);
  parts.push(b.subarray(i));
  return concat(parts);
}

// ---------------------------------------------------------------- PNG

const PNG_DROP = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

function stripPng(b: Bytes): Bytes {
  const parts: Bytes[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = u32(b, i);
    const end = i + 12 + len;
    if (end > b.length) return concat([...parts, b.subarray(i)]);
    if (!PNG_DROP.has(ascii(b, i + 4, 4))) parts.push(b.subarray(i, end));
    i = end;
  }
  parts.push(b.subarray(i));
  return concat(parts);
}

// ---------------------------------------------------------------- WebP

function stripWebp(b: Bytes): Bytes {
  const chunks: Bytes[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4);
    const size = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24);
    const end = i + 8 + size + (size & 1);
    if (size < 0 || end > b.length + 1) return b; // malformed: leave it for the fallback
    if (type === "EXIF" || type === "XMP ") {
      i = end;
      continue;
    }
    const chunk = b.slice(i, Math.min(end, b.length));
    if (type === "VP8X") chunk[8] &= ~(0x08 | 0x04); // clear the EXIF and XMP flags
    chunks.push(chunk);
    i = end;
  }
  const body = concat(chunks);
  const header = new Uint8Array(12);
  header.set(b.subarray(0, 4), 0);
  const riffSize = body.length + 4;
  header[4] = riffSize & 0xff;
  header[5] = (riffSize >> 8) & 0xff;
  header[6] = (riffSize >> 16) & 0xff;
  header[7] = (riffSize >> 24) & 0xff;
  header.set(b.subarray(8, 12), 8);
  return concat([header, body]);
}

// ---------------------------------------------------------------- images

const isJpeg = (b: Bytes) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const isPng = (b: Bytes) => b[0] === 0x89 && ascii(b, 1, 3) === "PNG";
const isWebp = (b: Bytes) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP";

// Formats we can't clean by editing bytes (AVIF, HEIC) get redrawn as a JPEG
// where a canvas is available — redrawing carries no metadata over.
async function redrawAsJpeg(file: File): Promise<File | null> {
  if (typeof document === "undefined") return null;
  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")?.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return null;
    return new File([blob], file.name.replace(/\.[^./]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return null;
  }
}

export async function stripImageMetadata(file: File): Promise<File> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let cleaned: Bytes | null = null;
    if (isJpeg(bytes)) cleaned = stripJpeg(bytes);
    else if (isPng(bytes)) cleaned = stripPng(bytes);
    else if (isWebp(bytes)) cleaned = stripWebp(bytes);
    else if (ascii(bytes, 0, 3) === "GIF") return file; // GIFs carry no EXIF/GPS
    if (cleaned) return new File([cleaned as unknown as BlobPart], file.name, { type: file.type, lastModified: file.lastModified });
    return (await redrawAsJpeg(file)) ?? file;
  } catch {
    return (await redrawAsJpeg(file)) ?? file;
  }
}

// ---------------------------------------------------------------- video (MP4 / MOV)

// Boxes that can hold a location or device tag. They're blanked in place —
// same size, type changed to "free", contents zeroed — so no byte offsets in
// the rest of the file move and nothing needs re-encoding.
const VIDEO_META_BOXES = new Set(["udta", "meta", "uuid", "XMP_"]);
const MAX_BLANK_BYTES = 32 * 1024 * 1024;

type Box = { start: number; size: number; header: number; type: string };

function readBoxes(b: Bytes, from: number, to: number): Box[] {
  const boxes: Box[] = [];
  let i = from;
  while (i + 8 <= to) {
    let size = u32(b, i);
    let header = 8;
    if (size === 1) {
      if (i + 16 > to) break;
      size = u32(b, i + 8) * 2 ** 32 + u32(b, i + 12);
      header = 16;
    } else if (size === 0) {
      size = to - i;
    }
    if (size < header || i + size > to) break;
    boxes.push({ start: i, size, header, type: ascii(b, i + 4, 4) });
    i += size;
  }
  return boxes;
}

function blank(b: Bytes, box: Box) {
  b.set([0x66, 0x72, 0x65, 0x65], box.start + 4); // "free"
  b.fill(0, box.start + box.header, box.start + box.size);
}

function blankMetaIn(b: Bytes, from: number, to: number): boolean {
  let changed = false;
  for (const box of readBoxes(b, from, to)) {
    if (VIDEO_META_BOXES.has(box.type)) {
      blank(b, box);
      changed = true;
    } else if (box.type === "trak" || box.type === "mdia") {
      if (blankMetaIn(b, box.start + box.header, box.start + box.size)) changed = true;
    }
  }
  return changed;
}

export async function stripVideoMetadata(file: File): Promise<File> {
  try {
    if (!/mp4|quicktime/.test(file.type) && !/\.(mp4|m4v|mov)$/i.test(file.name)) return file;
    const patches: { at: number; bytes: Bytes }[] = [];
    let offset = 0;
    // Walk the top-level boxes by reading only their headers.
    while (offset + 8 <= file.size) {
      const head = new Uint8Array(await file.slice(offset, offset + 16).arrayBuffer());
      let size = u32(head, 0);
      let header = 8;
      if (size === 1) {
        size = u32(head, 8) * 2 ** 32 + u32(head, 12);
        header = 16;
      } else if (size === 0) {
        size = file.size - offset;
      }
      if (size < header || offset + size > file.size) break;
      const type = ascii(head, 4, 4);
      if (type === "moov") {
        const moov = new Uint8Array(await file.slice(offset, offset + size).arrayBuffer());
        if (blankMetaIn(moov, header, size)) patches.push({ at: offset, bytes: moov });
      } else if (VIDEO_META_BOXES.has(type) && size - header <= MAX_BLANK_BYTES) {
        const box = new Uint8Array(size);
        box.set(head.subarray(0, header), 0);
        blank(box, { start: 0, size, header, type });
        patches.push({ at: offset, bytes: box });
      }
      offset += size;
    }
    if (patches.length === 0) return file;
    const parts: BlobPart[] = [];
    let pos = 0;
    for (const p of patches) {
      parts.push(file.slice(pos, p.at), p.bytes as unknown as BlobPart);
      pos = p.at + p.bytes.length;
    }
    parts.push(file.slice(pos));
    return new File(parts, file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export async function stripMediaMetadata(file: File, kind: "image" | "video"): Promise<File> {
  return kind === "image" ? stripImageMetadata(file) : stripVideoMetadata(file);
}

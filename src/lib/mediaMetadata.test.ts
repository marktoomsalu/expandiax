import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import exifr from "exifr";
import { stripImageMetadata, stripVideoMetadata } from "./mediaMetadata";

const enc = (s: string) => new TextEncoder().encode(s);
const text = (b: Uint8Array) => new TextDecoder("latin1").decode(b);
const bytesOf = async (f: File) => new Uint8Array(await f.arrayBuffer());
const u32 = (n: number) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const cat = (...p: Uint8Array[]) => {
  const out = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of p) {
    out.set(x, o);
    o += x.length;
  }
  return out;
};

describe("stripImageMetadata — JPEG", () => {
  const original = new Uint8Array(readFileSync(new URL("./__fixtures__/photo-with-gps.jpg", import.meta.url)));
  const file = new File([original as unknown as BlobPart], "photo.jpg", { type: "image/jpeg" });

  it("the fixture really carries GPS, device info and a comment (test is meaningful)", async () => {
    const gps = await exifr.gps(original);
    expect(gps?.latitude).toBeCloseTo(59.4417, 3);
    expect(gps?.longitude).toBeCloseTo(24.7458, 3);
    expect(text(original)).toContain("TestCam");
    expect(text(original)).toContain("home address here");
  });

  it("removes GPS, device, software, date and comment data", async () => {
    const out = await bytesOf(await stripImageMetadata(file));
    expect(await exifr.gps(out)).toBeUndefined();
    const tags = (await exifr.parse(out, true)) ?? {};
    expect(tags.Make).toBeUndefined();
    expect(tags.Model).toBeUndefined();
    expect(tags.Software).toBeUndefined();
    expect(tags.DateTimeOriginal).toBeUndefined();
    const raw = text(out);
    for (const secret of ["TestCam", "X100", "secret-software", "home address here", "2025:07:12"]) expect(raw).not.toContain(secret);
  });

  it("keeps the rotation so the photo doesn't turn sideways", async () => {
    const out = await bytesOf(await stripImageMetadata(file));
    expect(await exifr.orientation(out)).toBe(6);
  });

  it("leaves the picture itself byte-for-byte untouched", async () => {
    const out = await bytesOf(await stripImageMetadata(file));
    const scan = (b: Uint8Array) => {
      for (let i = 2; i < b.length - 1; i++) if (b[i] === 0xff && b[i + 1] === 0xda) return b.subarray(i);
      throw new Error("no scan data");
    };
    expect(Array.from(scan(out))).toEqual(Array.from(scan(original)));
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);
    expect(out[out.length - 2]).toBe(0xff);
    expect(out[out.length - 1]).toBe(0xd9);
    expect(out.length).toBeLessThan(original.length);
  });

  it("keeps the file's name and type", async () => {
    const result = await stripImageMetadata(file);
    expect(result.name).toBe("photo.jpg");
    expect(result.type).toBe("image/jpeg");
  });

  it("adds no EXIF at all when the photo needs no rotation", async () => {
    // Same fixture but with the orientation removed by stripping twice's opposite: build one with orientation 1.
    const upright = original.slice();
    // Orientation value lives as SHORT 6 in the fixture's EXIF; find "Exif" and flip 0x0112 entry's value to 1.
    const s = text(upright);
    const exif = s.indexOf("Exif\0\0");
    const tiff = exif + 6;
    const little = upright[tiff] === 0x49;
    const ifd = tiff + (little ? upright[tiff + 4] | (upright[tiff + 5] << 8) : (upright[tiff + 4] << 24) | (upright[tiff + 5] << 16) | (upright[tiff + 6] << 8) | upright[tiff + 7]);
    const count = little ? upright[ifd] | (upright[ifd + 1] << 8) : (upright[ifd] << 8) | upright[ifd + 1];
    for (let n = 0; n < count; n++) {
      const e = ifd + 2 + n * 12;
      const tag = little ? upright[e] | (upright[e + 1] << 8) : (upright[e] << 8) | upright[e + 1];
      if (tag === 0x0112) {
        if (little) upright[e + 8] = 1;
        else upright[e + 9] = 1;
      }
    }
    const out = await bytesOf(await stripImageMetadata(new File([upright as unknown as BlobPart], "u.jpg", { type: "image/jpeg" })));
    expect(text(out)).not.toContain("Exif");
  });
});

describe("stripImageMetadata — PNG and WebP", () => {
  const chunk = (type: string, data: Uint8Array) => cat(u32(data.length), enc(type), data, u32(0)); // CRC isn't checked

  it("PNG: drops EXIF/text/time chunks, keeps everything else", async () => {
    const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = chunk("IHDR", new Uint8Array(13));
    const idat = chunk("IDAT", enc("pixels"));
    const iend = chunk("IEND", new Uint8Array(0));
    const png = cat(sig, ihdr, chunk("eXIf", enc("GPS 59.43N")), chunk("tEXt", enc("Comment\0home")), chunk("tIME", new Uint8Array(7)), idat, iend);
    const out = await bytesOf(await stripImageMetadata(new File([png as unknown as BlobPart], "a.png", { type: "image/png" })));
    expect(Array.from(out)).toEqual(Array.from(cat(sig, ihdr, idat, iend)));
  });

  it("WebP: drops EXIF/XMP chunks, clears the flags and fixes the size", async () => {
    const riffChunk = (type: string, data: Uint8Array) => {
      const size = new Uint8Array([data.length & 255, (data.length >> 8) & 255, 0, 0]);
      return cat(enc(type), size, data, data.length % 2 ? new Uint8Array(1) : new Uint8Array(0));
    };
    const vp8x = new Uint8Array(10);
    vp8x[0] = 0x08 | 0x04; // EXIF + XMP present
    const vp8 = riffChunk("VP8 ", enc("imagedata!!"));
    const body = cat(enc("WEBP"), riffChunk("VP8X", vp8x), vp8, riffChunk("EXIF", enc("GPS home")), riffChunk("XMP ", enc("<x:xmpmeta/>")));
    const webp = cat(enc("RIFF"), new Uint8Array([body.length & 255, (body.length >> 8) & 255, 0, 0]), body);
    const out = await bytesOf(await stripImageMetadata(new File([webp as unknown as BlobPart], "a.webp", { type: "image/webp" })));
    const s = text(out);
    expect(s).not.toContain("EXIF");
    expect(s).not.toContain("XMP ");
    expect(s).not.toContain("GPS home");
    expect(s).toContain("imagedata!!");
    expect(out[8 + 4 + 8]).toBe(0); // VP8X flags cleared
    const riffSize = out[4] | (out[5] << 8) | (out[6] << 16) | (out[7] << 24);
    expect(riffSize).toBe(out.length - 8);
  });

  it("GIF is returned untouched", async () => {
    const gif = new File([enc("GIF89a....")], "a.gif", { type: "image/gif" });
    expect(await stripImageMetadata(gif)).toBe(gif);
  });
});

describe("stripVideoMetadata — MP4 / MOV", () => {
  const box = (type: string, ...children: Uint8Array[]) => {
    const payload = cat(...children);
    return cat(u32(8 + payload.length), enc(type), payload);
  };
  const ftyp = box("ftyp", enc("qt  "), new Uint8Array(4));
  const mvhd = box("mvhd", new Uint8Array(20));
  const stco = box("stco", u32(0), u32(1), u32(4242)); // an offset that must not be disturbed
  const mdat = box("mdat", enc("VIDEO-FRAMES-VIDEO-FRAMES"));
  const gpsTag = box("udta", box("©xyz", enc("+59.4341+024.7455/")));
  const iphoneMeta = box("meta", box("keys", enc("com.apple.quicktime.location.ISO6709")), box("ilst", enc("+59.4341+024.7455+003.0/")));
  const trak = box("trak", box("tkhd", new Uint8Array(20)), box("mdia", stco), box("udta", enc("Lat+59.43 device iPhone")));
  const moov = box("moov", mvhd, gpsTag, iphoneMeta, trak);

  const asFile = (parts: Uint8Array[], name = "clip.mov", type = "video/quicktime") => new File(parts as unknown as BlobPart[], name, { type });

  it("blanks location and device tags without changing the file's size or layout", async () => {
    const original = cat(ftyp, mdat, moov); // moov after mdat, like an iPhone recording
    const out = await bytesOf(await stripVideoMetadata(asFile([original])));
    expect(out.length).toBe(original.length);
    const s = text(out);
    for (const secret of ["ISO6709", "+59.4341", "Lat+59.43", "iPhone", "©xyz", "com.apple.quicktime.location"]) expect(s).not.toContain(secret);
    expect(s.match(/free/g)?.length).toBeGreaterThanOrEqual(3);
    // ftyp and mdat are byte-identical, and the offset table is untouched
    expect(Array.from(out.subarray(0, ftyp.length + mdat.length))).toEqual(Array.from(cat(ftyp, mdat)));
    expect(text(out)).toContain("VIDEO-FRAMES");
    expect(Array.from(out).join(",")).toContain(Array.from(stco).join(","));
  });

  it("also handles a fast-start file (moov before mdat) and a stray top-level uuid box", async () => {
    const uuid = box("uuid", enc("XMP with GPS +59.4341"));
    const original = cat(ftyp, moov, uuid, mdat);
    const out = await bytesOf(await stripVideoMetadata(asFile([original], "clip.mp4", "video/mp4")));
    expect(out.length).toBe(original.length);
    expect(text(out)).not.toContain("+59.4341");
    expect(text(out)).not.toContain("XMP with GPS");
    expect(text(out)).toContain("VIDEO-FRAMES");
  });

  it("returns a file with nothing to strip unchanged", async () => {
    const clean = asFile([cat(ftyp, box("moov", mvhd), mdat)]);
    expect(await stripVideoMetadata(clean)).toBe(clean);
  });

  it("leaves other video types alone", async () => {
    const webm = new File([enc("webm data")], "a.webm", { type: "video/webm" });
    expect(await stripVideoMetadata(webm)).toBe(webm);
  });
});

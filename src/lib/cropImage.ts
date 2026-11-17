export type CropPixels = { x: number; y: number; width: number; height: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Crops an image to the given pixel region and re-encodes it as a fixed-size square JPEG. */
export async function getCroppedImageBlob(
  imageSrc: string,
  crop: CropPixels,
  outputSize = 512
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the crop.");

  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, outputSize, outputSize);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not export the cropped image."))),
      "image/jpeg",
      0.9
    );
  });
}

/**
 * A memory photo after editing: turned by `rotation` degrees, then cut to
 * `crop` (pixels of the turned picture, as react-easy-crop reports them),
 * at most `maxSide` pixels on its longest side, as a JPEG.
 */
export async function getEditedImageBlob(imageSrc: string, crop: CropPixels, rotation: number, maxSide = 2560): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const rad = (rotation * Math.PI) / 180;
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const turnedW = Math.round(Math.abs(Math.cos(rad)) * w + Math.abs(Math.sin(rad)) * h);
  const turnedH = Math.round(Math.abs(Math.sin(rad)) * w + Math.abs(Math.cos(rad)) * h);

  const turned = document.createElement("canvas");
  turned.width = turnedW;
  turned.height = turnedH;
  const tctx = turned.getContext("2d");
  if (!tctx) throw new Error("Could not prepare the photo.");
  tctx.translate(turnedW / 2, turnedH / 2);
  tctx.rotate(rad);
  tctx.drawImage(image, -w / 2, -h / 2);

  const scale = Math.min(1, maxSide / Math.max(crop.width, crop.height));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(crop.width * scale));
  out.height = Math.max(1, Math.round(crop.height * scale));
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Could not prepare the photo.");
  octx.imageSmoothingQuality = "high";
  octx.drawImage(turned, crop.x, crop.y, crop.width, crop.height, 0, 0, out.width, out.height);

  return new Promise((resolve, reject) => {
    out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not save the edited photo."))), "image/jpeg", 0.9);
  });
}

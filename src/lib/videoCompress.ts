import type { FFmpeg } from "@ffmpeg/ffmpeg";

// Single-threaded ffmpeg-core: no SharedArrayBuffer, so no cross-origin
// isolation (COOP/COEP) headers needed on the site — those would break the
// Google sign-in popup. Slower than the multi-threaded core, but works
// everywhere with zero site-wide header changes.
const CORE_VERSION = "0.12.6";
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

let ffmpegPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ffmpeg;
    })();
  }
  return ffmpegPromise;
}

/**
 * Re-encodes a video client-side to ~720p / a lower bitrate so it uploads
 * fast on a slow connection. Runs entirely in the browser via ffmpeg.wasm —
 * nothing is sent anywhere to be compressed.
 */
export async function compressVideo(file: File, onProgress?: (pct: number) => void): Promise<File> {
  const { fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = await getFFmpeg();

  const inputName = `in-${Date.now()}`;
  const outputName = `out-${Date.now()}.mp4`;

  const onFfmpegProgress = ({ progress }: { progress: number }) => {
    onProgress?.(Math.min(99, Math.round(Math.max(0, progress) * 100)));
  };
  ffmpeg.on("progress", onFfmpegProgress);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    await ffmpeg.exec([
      "-i", inputName,
      "-vf", "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "28",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      outputName,
    ]);
    const data = await ffmpeg.readFile(outputName);
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
    onProgress?.(100);
    const newName = file.name.replace(/\.[^./]+$/, "") + "-compressed.mp4";
    return new File([bytes as unknown as BlobPart], newName, { type: "video/mp4" });
  } finally {
    ffmpeg.off("progress", onFfmpegProgress);
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}

/* eslint-disable @next/next/no-img-element -- drawn into a picture (next/og), not a page */
import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { ImageResponse } from "next/og";
import type { ThenMemory } from "@/components/ThenCard";
import { stockUrl } from "@/lib/stockPhotos";

const W = 1080;
const H = 1920;
const CARD = 900;
const PHOTO_H = 675;

// The app's fonts (Fraunces, Inter), fetched once per server.
const fontCache = new Map<string, Promise<ArrayBuffer | null>>();
function loadFont(query: string): Promise<ArrayBuffer | null> {
  let p = fontCache.get(query);
  if (!p) {
    p = (async () => {
      try {
        const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${query}`)).text();
        const url = /src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/.exec(css)?.[1];
        return url ? await (await fetch(url)).arrayBuffer() : null;
      } catch {
        return null;
      }
    })();
    fontCache.set(query, p);
  }
  return p;
}

let logo: Promise<string> | null = null;
function loadWelcomeLogo(): Promise<string> {
  logo ??= readFile(path.join(process.cwd(), "public", "wordmark.svg")).then((b) => `data:image/svg+xml;base64,${b.toString("base64")}`);
  return logo;
}

/** The photo, as the card shows it, and the same photo blurred deep for the background. */
async function pictures(url: string | null): Promise<{ hero: string | null; backdrop: string | null }> {
  if (!url) return { hero: null, backdrop: null };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { hero: null, backdrop: null };
    const buf = Buffer.from(await res.arrayBuffer());
    const [hero, backdrop] = await Promise.all([
      sharp(buf).rotate().resize(CARD * 2, PHOTO_H * 2, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer(),
      sharp(buf).rotate().resize(270, 480, { fit: "cover" }).blur(18).modulate({ saturation: 1.3 }).jpeg({ quality: 70 }).toBuffer(),
    ]);
    return { hero: `data:image/jpeg;base64,${hero.toString("base64")}`, backdrop: `data:image/jpeg;base64,${backdrop.toString("base64")}` };
  } catch {
    return { hero: null, backdrop: null };
  }
}

/**
 * "One to remember", for Instagram Stories (1080×1920): the card just as
 * the feed shows it, floating on the same photo blurred into ExpandiaX
 * purple, the ExpandiaX wordmark above.
 */
export async function renderMemoryStory(m: ThenMemory, photoId?: string | null): Promise<ImageResponse> {
  const chosen = (photoId && m.photos.find((p) => p.id === photoId)) || m.photos[0];
  const photoUrl = chosen?.url ?? m.fallbackImage ?? (m.stock ? stockUrl(m.stock.raw, 1600, "4:3", 80) : null);
  const [{ hero, backdrop }, font, italic, inter, interBold, wordmark] = await Promise.all([
    pictures(photoUrl),
    loadFont("Fraunces:opsz,wght@72,600"),
    loadFont("Fraunces:ital,opsz,wght@1,72,400"),
    loadFont("Inter:wght@400"),
    loadFont("Inter:wght@700"),
    loadWelcomeLogo(),
  ]);
  const fonts = [
    font && { name: "Fraunces", data: font, weight: 600 as const, style: "normal" as const },
    italic && { name: "Fraunces", data: italic, weight: 400 as const, style: "italic" as const },
    inter && { name: "Inter", data: inter, weight: 400 as const, style: "normal" as const },
    interBold && { name: "Inter", data: interBold, weight: 700 as const, style: "normal" as const },
  ].filter((f): f is NonNullable<typeof f> => !!f);
  const meta = [m.dateLabel, m.place].filter(Boolean).join("  ·  ");
  const titleSize = m.title.length > 22 ? 64 : m.title.length > 14 ? 76 : 88;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: W, height: H, position: "relative", background: "#2b0b2e", fontFamily: "Inter" }}>
        {/* The memory itself, blurred into the brand's night purple */}
        {backdrop && <img alt="" src={backdrop} width={W} height={H} style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover" }} />}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: W,
            height: H,
            display: "flex",
            background: "linear-gradient(180deg, rgba(43,11,46,0.78) 0%, rgba(90,23,88,0.62) 45%, rgba(20,5,26,0.88) 100%)",
          }}
        />
        <div style={{ position: "absolute", top: 520, left: 90, width: 900, height: 900, display: "flex", borderRadius: 999, background: "radial-gradient(circle, rgba(250,81,162,0.35) 0%, rgba(250,81,162,0) 70%)" }} />

        {/* Logo, card and words, clear of Instagram's own name bar (top) and reply field (bottom) */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", width: W, height: H, paddingTop: 260, paddingBottom: 300 }}>
          {/* ExpandiaX */}
          <img alt="" src={wordmark} width={420} height={123} style={{ width: 420, height: 123 }} />

          {/* The card */}
          <div
            style={{
              width: CARD,
              display: "flex",
              flexDirection: "column",
              borderRadius: 56,
              overflow: "hidden",
              background: "#ffffff",
              boxShadow: "0 50px 120px rgba(0,0,0,0.55)",
            }}
          >
            <div style={{ display: "flex", width: CARD, height: PHOTO_H, position: "relative", background: `linear-gradient(135deg, ${m.gradient[0]}, ${m.gradient[1]})` }}>
              {hero && <img alt="" src={hero} width={CARD} height={PHOTO_H} style={{ width: CARD, height: PHOTO_H, objectFit: "cover" }} />}
            </div>
            <div style={{ display: "flex", flexDirection: "column", padding: "44px 56px 52px" }}>
              {m.eyebrow && (
                <div style={{ display: "flex", alignItems: "center", alignSelf: "flex-start", padding: "10px 24px 10px 18px", borderRadius: 999, background: "linear-gradient(90deg, #fa51a2, #fb7822)", color: "white", fontSize: 30, fontWeight: 700 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" style={{ marginRight: 10 }}>
                    <path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z" fill="white" />
                  </svg>
                  {m.eyebrow}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", marginTop: 24, fontFamily: font ? "Fraunces" : "Inter", fontSize: titleSize, fontWeight: 600, color: "#17171b", lineHeight: 1.05 }}>
                {m.flag ? `${m.flag} ` : ""}
                {m.title}
              </div>
              {m.words && <div style={{ display: "flex", marginTop: 18, fontFamily: font ? "Fraunces" : "Inter", fontStyle: "italic", fontWeight: 400, fontSize: 34, color: "#5b6170", lineHeight: 1.3 }}>{`“${m.words.slice(0, 110)}${m.words.length > 110 ? "…" : ""}”`}</div>}
              {meta && <div style={{ display: "flex", marginTop: 22, fontSize: 32, color: "#5b6170" }}>{meta}</div>}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "white" }}>
            <div style={{ display: "flex", fontFamily: font ? "Fraunces" : "Inter", fontSize: 44, fontStyle: "italic", fontWeight: 400 }}>Your world, remembered.</div>
            <div style={{ display: "flex", marginTop: 14, fontSize: 30, opacity: 0.7, letterSpacing: 2 }}>expandiax.com</div>
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      emoji: "twemoji",
      fonts: fonts.length ? fonts : undefined,
      headers: { "Cache-Control": "private, max-age=300" },
    }
  );
}

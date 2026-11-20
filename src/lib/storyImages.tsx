import "server-only";
import { ImageResponse } from "next/og";
import { countryByCode } from "./countries";
import { countryPathD } from "./countryShape";
import { flagGradientColors } from "./flagColors";
import { svgDataUri, worldMapSvg } from "./worldMapSvg";

/* ------------------------------------------------------------------ */
/* Fonts                                                               */
/* ------------------------------------------------------------------ */

/** A Google font as TrueType (what a plain request gets), or null if that fails. */
async function googleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`, { cache: "force-cache" })).text();
    const url = css.match(/src: url\((https:[^)]+\.ttf)\)/)?.[1];
    return url ? await (await fetch(url, { cache: "force-cache" })).arrayBuffer() : null;
  } catch {
    return null;
  }
}

type Font = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700; style: "normal" };
async function fonts(): Promise<Font[]> {
  const [serif, hand, regular, bold] = await Promise.all([googleFont("Fraunces", 600), googleFont("Caveat", 700), googleFont("Inter", 400), googleFont("Inter", 700)]);
  const out: Font[] = [];
  if (regular) out.push({ name: "Inter", data: regular, weight: 400, style: "normal" });
  if (bold) out.push({ name: "Inter", data: bold, weight: 700, style: "normal" });
  if (serif) out.push({ name: "Fraunces", data: serif, weight: 600, style: "normal" });
  if (hand) out.push({ name: "Caveat", data: hand, weight: 700, style: "normal" });
  return out;
}

/** A photo as a data URI (JPEG through Next's image optimiser, so it's light and never WebP). */
async function photoData(origin: string, src: string | null, width: number): Promise<string | null> {
  if (!src) return null;
  try {
    const res = await fetch(`${origin}/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=80`, { headers: { Accept: "image/jpeg,image/png" } });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!/jpe?g|png/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

const INK = "#1e2a6e"; // a ballpoint's blue, like the sketch
const headers = { "Cache-Control": "private, max-age=300" };

/* ------------------------------------------------------------------ */
/* A trip as a sticker                                                 */
/* ------------------------------------------------------------------ */

export type TripSticker = { countryCode: string; place: string; when: string; photo: string | null };

/** The photo, or (no photo yet) the country's own shape on its flag's colours. */
function Picture({ trip, w, h, img }: { trip: TripSticker; w: number; h: number; img: string | null }) {
  if (img) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={img} alt="" width={w} height={h} style={{ width: w, height: h, objectFit: "cover" }} />;
  }
  const meta = countryByCode(trip.countryCode);
  const [a, b] = flagGradientColors(trip.countryCode);
  const d = countryPathD(meta?.numeric, Math.min(w, h) * 0.8);
  const size = Math.min(w, h) * 0.8;
  return (
    <div style={{ width: w, height: h, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${a}, ${b})` }}>
      {d ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><path d="${d}" fill="rgba(255,255,255,0.92)"/></svg>`)}
          alt=""
          width={size}
          height={size}
        />
      ) : (
        <div style={{ display: "flex", fontSize: 220 }}>{meta?.flag}</div>
      )}
    </div>
  );
}

/** The handwritten tag: flag and place, the dates, a small ExpandiaX. */
function Tag({ trip, rotate, width }: { trip: TripSticker; rotate: number; width: number }) {
  const flag = countryByCode(trip.countryCode)?.flag ?? "";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        padding: "26px 40px 22px",
        background: "#fffdf7",
        borderRadius: 10,
        transform: `rotate(${rotate}deg)`,
        boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
        color: INK,
        fontFamily: "Caveat",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 84, lineHeight: 1 }}>
        <span style={{ fontSize: 64 }}>{flag}</span>
        <span>{trip.place}</span>
      </div>
      {trip.when && <div style={{ display: "flex", fontSize: 58, marginTop: 8, lineHeight: 1 }}>{trip.when}</div>}
      <div style={{ display: "flex", alignSelf: "flex-end", marginTop: 10, fontSize: 30, fontFamily: "Fraunces" }}>
        <span style={{ color: "#fb8a4e" }}>Expandia</span>
        <span style={{ color: "#fa51a2" }}>X</span>
      </div>
    </div>
  );
}

/** A postage stamp: the photo framed in white with a scalloped edge, tilted, the tag pinned under it. Transparent around it. */
export async function stampSticker(origin: string, trip: TripSticker) {
  const [img, f] = await Promise.all([photoData(origin, trip.photo, 1080), fonts()]);
  const W = 820;
  const H = 960;
  const PAD = 34;
  const R = 17;
  const STEP = 44;
  // The stamp's teeth: white circles along every edge.
  const teeth: { left: number; top: number }[] = [];
  const outerW = W + PAD * 2;
  const outerH = H + PAD * 2;
  for (let x = R; x <= outerW - R; x += STEP) {
    teeth.push({ left: x - R, top: -R });
    teeth.push({ left: x - R, top: outerH - R });
  }
  for (let y = R + STEP; y <= outerH - R - STEP / 2; y += STEP) {
    teeth.push({ left: -R, top: y - R });
    teeth.push({ left: outerW - R, top: y - R });
  }

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 70 }}>
        <div style={{ display: "flex", position: "relative", width: outerW, height: outerH, transform: "rotate(-4deg)" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: outerW, height: outerH, background: "white", boxShadow: "0 24px 60px rgba(0,0,0,0.35)" }} />
          {teeth.map((t, i) => (
            <div key={i} style={{ position: "absolute", left: t.left, top: t.top, width: R * 2, height: R * 2, borderRadius: R, background: "white" }} />
          ))}
          <div style={{ position: "absolute", left: PAD, top: PAD, display: "flex", overflow: "hidden" }}>
            <Picture trip={trip} w={W} h={H} img={img} />
          </div>
        </div>
        <div style={{ display: "flex", marginTop: -70, marginLeft: 120 }}>
          <Tag trip={trip} rotate={3} width={720} />
        </div>
      </div>
    ),
    { width: 1080, height: 1500, emoji: "twemoji", fonts: f, headers }
  );
}

/** A polaroid: the photo in a white frame, the place and dates written in its wide bottom margin. Transparent around it. */
export async function polaroidSticker(origin: string, trip: TripSticker) {
  const [img, f] = await Promise.all([photoData(origin, trip.photo, 1080), fonts()]);
  const flag = countryByCode(trip.countryCode)?.flag ?? "";
  const W = 860;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "44px 44px 30px",
            background: "#fffdf7",
            transform: "rotate(3deg)",
            boxShadow: "0 30px 70px rgba(0,0,0,0.35)",
            fontFamily: "Caveat",
            color: INK,
          }}
        >
          <div style={{ display: "flex", overflow: "hidden" }}>
            <Picture trip={trip} w={W} h={W} img={img} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 30, fontSize: 82, lineHeight: 1 }}>
            <span style={{ fontSize: 60 }}>{flag}</span>
            <span>{trip.place}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 }}>
            <span style={{ fontSize: 58, lineHeight: 1 }}>{trip.when}</span>
            <span style={{ display: "flex", fontSize: 30, fontFamily: "Fraunces" }}>
              <span style={{ color: "#fb8a4e" }}>Expandia</span>
              <span style={{ color: "#fa51a2" }}>X</span>
            </span>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, emoji: "twemoji", fonts: f, headers }
  );
}

/* ------------------------------------------------------------------ */
/* Your world                                                          */
/* ------------------------------------------------------------------ */

export type World = { name: string; codes: string[]; continents: number; percent: number; year: number };

const FLAG_ROWS = 3;
const FLAGS_PER_ROW = 8;

/** A Story of their whole world: the number, the map lit up, their flags, and the question that makes friends curious. */
export async function worldPoster(world: World) {
  const f = await fonts();
  const map = worldMapSvg(world.codes, { width: 1000 });
  const shown = world.codes.slice(0, FLAG_ROWS * FLAGS_PER_ROW - (world.codes.length > FLAG_ROWS * FLAGS_PER_ROW ? 1 : 0));
  const more = world.codes.length - shown.length;
  const flags = shown.map((c) => countryByCode(c)?.flag).filter(Boolean) as string[];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", color: "white", fontFamily: "Inter", background: "#1d0820" }}>
        <div style={{ position: "absolute", left: -300, top: -260, width: 1100, height: 1100, borderRadius: 1100, display: "flex", background: "radial-gradient(circle, rgba(250,81,162,0.38) 0%, rgba(250,81,162,0) 62%)" }} />
        <div style={{ position: "absolute", right: -360, bottom: -300, width: 1200, height: 1200, borderRadius: 1200, display: "flex", background: "radial-gradient(circle, rgba(251,120,34,0.30) 0%, rgba(251,120,34,0) 62%)" }} />

        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", padding: "150px 40px 0" }}>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 9, textTransform: "uppercase", color: "#ffb3d6" }}>{`${world.name}'s world`}</div>
          <div style={{ display: "flex", alignItems: "flex-end", marginTop: 20, fontFamily: "Fraunces" }}>
            <span style={{ fontSize: 290, lineHeight: 0.9, color: "#fa51a2" }}>{world.codes.length}</span>
            <span style={{ fontSize: 76, lineHeight: 1, marginLeft: 14, marginBottom: 22, color: "rgba(255,255,255,0.55)" }}>/195</span>
          </div>
          <div style={{ display: "flex", fontSize: 46, fontWeight: 700, marginTop: 18 }}>{world.codes.length === 1 ? "country" : "countries"}</div>
          <div style={{ display: "flex", fontSize: 32, marginTop: 14, color: "rgba(255,255,255,0.7)" }}>
            {`${world.continents} ${world.continents === 1 ? "continent" : "continents"} · ${world.percent}% of the world`}
          </div>
        </div>

        <div style={{ position: "relative", display: "flex", justifyContent: "center", marginTop: 70 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={svgDataUri(map.svg)} alt="" width={1000} height={map.height} />
        </div>

        <div style={{ position: "relative", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14, padding: "60px 70px 0" }}>
          {flags.map((fl, i) => (
            <div key={i} style={{ display: "flex", fontSize: 72, width: 96, justifyContent: "center" }}>
              {fl}
            </div>
          ))}
          {more > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 96, fontSize: 34, fontWeight: 700, color: "#ffb3d6" }}>+{more}</div>
          )}
        </div>

        <div style={{ position: "absolute", left: 0, right: 0, bottom: 120, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 44, fontFamily: "Fraunces" }}>{"What's your number?"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 22, padding: "14px 30px", borderRadius: 999, background: "rgba(255,255,255,0.1)", border: "2px solid rgba(255,255,255,0.18)" }}>
            <span style={{ display: "flex", fontSize: 34, fontFamily: "Fraunces" }}>
              <span style={{ color: "#fb8a4e" }}>Expandia</span>
              <span style={{ color: "#fa51a2" }}>X</span>
            </span>
            <span style={{ fontSize: 28, color: "rgba(255,255,255,0.7)" }}>map yours at expandiax.com</span>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, emoji: "twemoji", fonts: f, headers }
  );
}

/** The same world as a sticker: a glass card with the number and the map, to paste over any photo. */
export async function worldSticker(world: World) {
  const f = await fonts();
  const map = worldMapSvg(world.codes, { width: 860, land: "rgba(255,255,255,0.22)" });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 940,
            padding: "44px 40px 34px",
            borderRadius: 48,
            background: "rgba(29,8,32,0.82)",
            border: "3px solid rgba(255,255,255,0.18)",
            boxShadow: "0 30px 70px rgba(0,0,0,0.35)",
            color: "white",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "flex-end", fontFamily: "Fraunces" }}>
              <span style={{ fontSize: 150, lineHeight: 0.9, color: "#fa51a2" }}>{world.codes.length}</span>
              <span style={{ fontSize: 46, marginLeft: 14, marginBottom: 12, color: "rgba(255,255,255,0.6)" }}>countries</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginBottom: 10 }}>
              <span style={{ fontSize: 28, color: "rgba(255,255,255,0.7)" }}>{`${world.continents} continents · ${world.percent}%`}</span>
              <span style={{ display: "flex", fontSize: 30, fontFamily: "Fraunces", marginTop: 6 }}>
                <span style={{ color: "#fb8a4e" }}>Expandia</span>
                <span style={{ color: "#fa51a2" }}>X</span>
              </span>
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 26 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={svgDataUri(map.svg)} alt="" width={860} height={map.height} />
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: Math.round(map.height + 520), emoji: "twemoji", fonts: f, headers }
  );
}

/* ------------------------------------------------------------------ */

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];

/** "18–22 Sept 2026", "Sept – Oct 2026", "2019": as you'd write it on a tag. */
export function stickerDate(v: { year: number; visited_from: string | null; visited_to: string | null; date_precision?: string | null }): string {
  const precision = v.date_precision ?? (v.visited_from ? "day" : "year");
  if (precision === "year" || !v.visited_from) return String(v.year);
  const [ay, am, ad] = v.visited_from.split("-").map(Number);
  if (precision === "month") return `${SHORT[am - 1]} ${ay}`;
  const [by, bm, bd] = (v.visited_to ?? v.visited_from).split("-").map(Number);
  if (ay === by && am === bm) return ad === bd ? `${ad} ${SHORT[am - 1]} ${ay}` : `${ad}–${bd} ${SHORT[am - 1]} ${ay}`;
  if (ay === by) return `${ad} ${SHORT[am - 1]} – ${bd} ${SHORT[bm - 1]} ${ay}`;
  return `${SHORT[am - 1]} ${ay} – ${SHORT[bm - 1]} ${by}`;
}

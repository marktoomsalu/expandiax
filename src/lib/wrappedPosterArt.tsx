/* eslint-disable @next/next/no-img-element -- drawn into a picture (next/og) and, the same, on the phone */
// The Year Wrapped Story picture (1080×1920), drawn once, used twice: the
// server turns it into the PNG they share (wrappedPoster.tsx), and the phone
// shows the very same thing live while they pick its photos (WrappedCollage).
// Plain inline styles only, with every box a flex box: what next/og can draw.
// No comparison with last year: it's theirs to share, whatever the year was.

import type { GlobeArt } from "@/lib/globeArt";
import type { WrappedYear } from "@/lib/wrapped";

export const POSTER_W = 1080;
export const POSTER_H = 1920;
/** The big photo and the ones around it: how many photos the collage holds. */
export const COLLAGE_SLOTS = 5;
/** The globe's size on the picture, and how it's turned (their places near its top). */
export const POSTER_GLOBE = { size: 1640, tilt: 50, scale: 1, reach: 0.9, widen: true } as const;

// The big photo: [left, top, width, height, turn].
export const MAIN: [number, number, number, number, number] = [280, 640, 520, 470, -2];
/** The white frame round the big photo, and round the others. */
export const BORDER = { main: 7, around: 6 } as const;
/** The photo inside a frame, in pixels: exactly what it fills. */
export const inside = (box: [number, number, number, number, number], border: number) => [box[2] - border * 2, box[3] - border * 2] as const;
// Where the photos sit around the big one.
export const AROUND: [number, number, number, number, number][] = [
  [52, 676, 270, 210, -8],
  [36, 905, 255, 235, -5],
  [762, 666, 262, 225, 7],
  [780, 905, 250, 235, 6],
];

export type Fact = { value: number; label: string; icon: "plane" | "globe" | "calendar" | "pin" | "spark" };

/** Three facts that are really theirs: trips, countries, events first; places and new countries if those are missing. */
export function storyFacts(w: WrappedYear): Fact[] {
  const all: Fact[] = [
    { value: w.trips, label: w.trips === 1 ? "trip" : "trips", icon: "plane" },
    { value: w.countries.length, label: w.countries.length === 1 ? "country" : "countries", icon: "globe" },
    { value: w.events.length, label: w.events.length === 1 ? "event" : "events", icon: "calendar" },
    { value: w.places.length, label: w.places.length === 1 ? "place" : "places", icon: "pin" },
    { value: w.newCountries.length, label: "new countries", icon: "spark" },
  ];
  return all.filter((f) => f.value > 0).slice(0, 3);
}

// Lucide's shapes, drawn here.
const ICONS: Record<Fact["icon"], string[]> = {
  plane: ["M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"],
  globe: ["M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20", "M2 12h20", "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"],
  calendar: ["M8 2v4", "M16 2v4", "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M3 10h18"],
  pin: ["M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0", "M12 7a3 3 0 1 0 0 6 3 3 0 1 0 0-6"],
  spark: ["M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"],
};

export function PosterArt({
  year,
  facts,
  photos,
  globe,
  wordmark,
  onPhoto,
}: {
  year: number;
  facts: Fact[];
  /** The big one first, then the ones around it (image sources; null where there's none). */
  photos: (string | null)[];
  globe: GlobeArt | null;
  wordmark: string;
  /** On the phone: a photo was tapped (its place in `photos`). */
  onPhoto?: (slot: number) => void;
}) {
  const G = POSTER_GLOBE.size;
  const disc = globe?.disc ?? { cx: G / 2, cy: G / 2, r: G / 2 };
  const [main, ...others] = photos;
  const tap = (slot: number) => (onPhoto ? { onClick: () => onPhoto(slot), role: "button" as const } : {});
  // A white frame with the photo filling it exactly: the photo is sized in pixels to the inside of the frame.
  const frame = (box: [number, number, number, number, number], border: number, radius: number, shadow: string) => ({
    position: "absolute" as const,
    left: box[0],
    top: box[1],
    width: box[2],
    height: box[3],
    display: "flex",
    boxSizing: "border-box" as const,
    borderRadius: radius,
    border: `${border}px solid white`,
    overflow: "hidden",
    transform: `rotate(${box[4]}deg)`,
    boxShadow: shadow,
    background: "white",
  });
  const photo = (src: string, box: [number, number, number, number, number], border: number, radius: number) => {
    const [w, h] = inside(box, border);
    return <img alt="" src={src} width={w} height={h} style={{ width: w, height: h, minWidth: w, minHeight: h, flexShrink: 0, objectFit: "cover", borderRadius: radius - border }} />;
  };

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: POSTER_W,
        height: POSTER_H,
        fontFamily: "Inter",
        color: "white",
        background: "linear-gradient(180deg, #160a2b 0%, #2c1250 26%, #5b2577 46%, #a2508a 58%, #e9907a 66%, #3a1a52 78%, #120818 100%)",
        overflow: "hidden",
      }}
    >
      {/* A soft pink sun behind the photos */}
      <div style={{ position: "absolute", left: 140, top: 560, width: 800, height: 800, display: "flex", borderRadius: 999, background: "radial-gradient(circle, rgba(255,179,214,0.45) 0%, rgba(255,179,214,0) 65%)" }} />

      {/* The Earth at night, rising */}
      <svg width={G} height={G} viewBox={`0 0 ${G} ${G}`} style={{ position: "absolute", left: (POSTER_W - G) / 2, top: 1100 }}>
        <defs>
          <radialGradient id="wp-ocean" cx="50%" cy="20%" r="70%">
            <stop offset="0" stopColor="#24356a" />
            <stop offset="0.6" stopColor="#111a3a" />
            <stop offset="1" stopColor="#090e22" />
          </radialGradient>
          <linearGradient id="wp-lit" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff6cb5" />
            <stop offset="1" stopColor="#fb7822" />
          </linearGradient>
        </defs>
        <circle cx={disc.cx} cy={disc.cy} r={disc.r + 26} fill="rgba(196,140,255,0.28)" />
        <circle cx={disc.cx} cy={disc.cy} r={disc.r + 10} fill="rgba(226,190,255,0.45)" />
        <circle cx={disc.cx} cy={disc.cy} r={disc.r} fill="url(#wp-ocean)" />
        {/* A group, not a fragment: next/og can't draw a fragment inside an svg. */}
        {globe && (
          <g>
            <path d={globe.land} fill="#26386a" stroke="#3a4f8a" strokeWidth={1} />
            {globe.lit.map((c) => (
              <path key={c.code} d={c.d} fill={c.home ? "#fb7822" : "url(#wp-lit)"} stroke="#ffd1e8" strokeWidth={1.2} />
            ))}
            {globe.arcs.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="#ffd1e8" strokeWidth={4} strokeLinecap="round" />
            ))}
            {globe.dots.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={8} fill="#ffffff" />
            ))}
          </g>
        )}
      </svg>

      <div style={{ position: "absolute", left: 0, top: 0, width: POSTER_W, height: POSTER_H, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <img alt="" src={wordmark} width={330} height={97} style={{ marginTop: 100, width: 330, height: 97 }} />

        {/* My 2026 Wrapped */}
        <div style={{ display: "flex", position: "relative", flexDirection: "column", alignItems: "center", marginTop: 34 }}>
          <svg width={860} height={360} viewBox="0 0 860 360" style={{ position: "absolute", left: -110, top: 0 }}>
            <path d="M150 326 C 360 350, 640 338, 820 262" fill="none" stroke="#e7c6ff" strokeWidth={5} strokeLinecap="round" />
          </svg>
          <svg width={70} height={70} viewBox="0 0 24 24" style={{ position: "absolute", right: -70, top: -18 }}>
            <path d="M12 1 L14.2 9.8 L23 12 L14.2 14.2 L12 23 L9.8 14.2 L1 12 L9.8 9.8 Z" fill="#f3dcff" />
          </svg>
          <div style={{ display: "flex", fontFamily: "Fraunces", fontStyle: "italic", fontWeight: 700, fontSize: 150, lineHeight: 1, letterSpacing: -3 }}>
            <span style={{ marginRight: 34 }}>My</span>
            <span style={{ color: "#e7c6ff" }}>{String(year)}</span>
          </div>
          <div style={{ display: "flex", fontFamily: "Fraunces", fontStyle: "italic", fontWeight: 700, fontSize: 150, lineHeight: 1, letterSpacing: -3, marginTop: 4 }}>Wrapped</div>
        </div>
        <div style={{ display: "flex", marginTop: 34, fontSize: 42, color: "rgba(255,255,255,0.88)" }}>A year in experiences</div>
      </div>

      {/* Their photos around the big one */}
      {others.slice(0, AROUND.length).map((src, i) =>
        src ? (
          <div key={`${i}-${src}`} style={frame(AROUND[i], BORDER.around, 26, "0 24px 50px rgba(0,0,0,0.45)")} {...tap(i + 1)}>
            {photo(src, AROUND[i], BORDER.around, 26)}
          </div>
        ) : null
      )}
      {main && (
        <div key={`main-${main}`} style={frame(MAIN, BORDER.main, 34, "0 34px 70px rgba(0,0,0,0.55)")} {...tap(0)}>
          {photo(main, MAIN, BORDER.main, 34)}
        </div>
      )}

      {/* My year at a glance */}
      {facts.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: 90,
            top: 1440,
            width: 900,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "26px 10px 30px",
            borderRadius: 42,
            background: "rgba(22,11,40,0.72)",
            border: "2px solid rgba(255,255,255,0.16)",
          }}
        >
          <div style={{ display: "flex", fontSize: 34, fontWeight: 600, color: "rgba(255,255,255,0.85)", marginBottom: 22 }}>My year at a glance</div>
          <div style={{ display: "flex", width: "100%" }}>
            {facts.map((f, i) => (
              <div key={f.label} style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", borderLeft: i ? "2px solid rgba(255,255,255,0.12)" : "none" }}>
                <svg width={46} height={46} viewBox="0 0 24 24" fill="none" stroke="#e7c6ff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  {ICONS[f.icon].map((d) => (
                    <path key={d} d={d} />
                  ))}
                </svg>
                <div style={{ display: "flex", marginTop: 10, fontSize: 92, fontWeight: 700, lineHeight: 1 }}>{f.value}</div>
                <div style={{ display: "flex", marginTop: 6, fontSize: 36 }}>{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

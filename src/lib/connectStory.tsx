/* eslint-disable @next/next/no-img-element -- next/og draws plain <img> */
// World Connect, as a picture for Instagram Stories (1080×1920): the two of
// you, the countries you've both been to (a big gold number, their flags and
// a globe lit in three colours), what each can show the other, and how alike
// your worlds are. ExpandiaX only as a small logo at the top.

import { ImageResponse } from "next/og";
import { countryByCode } from "@/lib/countries";
import { drawGlobe } from "@/lib/globeArt";
import { compareGlobes, travelMatch, type GlobeCountry } from "@/lib/globeTouchLogic";
import { loadFont, loadLogo, loadWorld, photoData } from "@/lib/wrappedPoster";

const W = 1080;
const H = 1920;
// World Connect's colours (as on the screen).
const MINE = "#fb7822";
const THEIRS = "#a66cf0";
const BOTH = "#f5c242";

export type ConnectPerson = { name: string; avatar: string | null };

function Face({ photo, name, ring }: { photo: string | null; name: string; ring: string }) {
  return (
    <div style={{ display: "flex", width: 184, height: 184, borderRadius: 999, padding: 7, background: ring }}>
      <div style={{ display: "flex", width: 170, height: 170, borderRadius: 999, overflow: "hidden", alignItems: "center", justifyContent: "center", background: "#2b0b2e", fontFamily: "Fraunces", fontSize: 80, color: "white" }}>
        {photo ? <img alt="" src={photo} width={170} height={170} style={{ width: 170, height: 170, objectFit: "cover" }} /> : name.charAt(0).toUpperCase()}
      </div>
    </div>
  );
}

function Side({ color, n, label, codes }: { color: string; n: number; label: string; codes: string[] }) {
  const flags = codes.slice(0, 4).map((c) => countryByCode(c)?.flag ?? "").join(" ");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 440, padding: "20px 20px 18px", borderRadius: 34, background: "rgba(255,255,255,0.07)", border: `2px solid ${color}55` }}>
      <div style={{ display: "flex", alignItems: "center", fontSize: 30, color: "rgba(255,255,255,0.8)" }}>
        <div style={{ display: "flex", width: 18, height: 18, borderRadius: 999, background: color, marginRight: 12 }} />
        {label}
      </div>
      <div style={{ display: "flex", marginTop: 6, fontFamily: "Fraunces", fontSize: 72, height: 84, alignItems: "center", color }}>{n}</div>
      <div style={{ display: "flex", marginTop: 6, fontSize: 36, height: 44 }}>{flags || " "}</div>
    </div>
  );
}

export async function renderConnectStory({ me, peer, mine, theirs }: { me: ConnectPerson; peer: ConnectPerson; mine: GlobeCountry[]; theirs: GlobeCountry[] }): Promise<ImageResponse> {
  const g = compareGlobes(mine, theirs);
  const match = travelMatch(g.both.length, g.both.length + g.onlyMine.length, g.both.length + g.onlyTheirs.length);
  const [myPhoto, theirPhoto, titleFont, inter, interSemi, wordmark, features] = await Promise.all([
    photoData(me.avatar, 340, 340),
    photoData(peer.avatar, 340, 340),
    loadFont("Fraunces:ital,opsz,wght@1,72,700"),
    loadFont("Inter:wght@400"),
    loadFont("Inter:wght@600"),
    loadLogo(),
    loadWorld(),
  ]);
  const fonts = [
    titleFont && { name: "Fraunces", data: titleFont, weight: 700 as const, style: "italic" as const },
    inter && { name: "Inter", data: inter, weight: 400 as const, style: "normal" as const },
    interSemi && { name: "Inter", data: interSemi, weight: 600 as const, style: "normal" as const },
  ].filter((f): f is NonNullable<typeof f> => !!f);

  // The globe turned towards what you share (or, sharing nothing, towards both your worlds).
  const G = 500;
  const lit = [...g.both, ...g.onlyMine, ...g.onlyTheirs];
  const globe = drawGlobe(features, { size: G, countries: lit, focus: g.both.length ? g.both : lit, scale: 0.93, tilt: 12, widen: true });
  const colorOf = (code: string) => (g.both.includes(code) ? BOTH : g.onlyMine.includes(code) ? MINE : THEIRS);

  const sharedFlags = g.both.slice(0, 8).map((c) => countryByCode(c)?.flag ?? "").join(" ");
  const more = g.both.length - 8;

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          fontFamily: "Inter",
          color: "white",
          background: "radial-gradient(120% 70% at 50% 0%, #5a1758 0%, #2b0b2e 48%, #12041a 100%)",
          overflow: "hidden",
        }}
      >
        {/* A warm glow behind the globe */}
        <div style={{ position: "absolute", left: 190, top: 820, width: 700, height: 700, display: "flex", borderRadius: 999, background: "radial-gradient(circle, rgba(245,194,66,0.22) 0%, rgba(245,194,66,0) 62%)" }} />

        <img alt="" src={wordmark} width={240} height={70} style={{ marginTop: 96, width: 240, height: 70, opacity: 0.9 }} />

        {/* The two of you */}
        <div style={{ display: "flex", alignItems: "center", marginTop: 44 }}>
          <Face photo={myPhoto} name={me.name} ring="linear-gradient(135deg, #fb7822, #fa51a2)" />
          <div style={{ display: "flex", width: 44, height: 44, marginLeft: -22, marginRight: -22, borderRadius: 999, background: "radial-gradient(circle, #fff6d8 0%, #f5c242 55%, rgba(245,194,66,0) 75%)" }} />
          <Face photo={theirPhoto} name={peer.name} ring="linear-gradient(135deg, #fa51a2, #8b3fd9)" />
        </div>
        <div style={{ display: "flex", marginTop: 20, fontFamily: "Fraunces", fontStyle: "italic", fontSize: 64 }}>
          {me.name} &amp; {peer.name}
        </div>

        {/* What you share */}
        {g.both.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 26 }}>
            <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 190, height: 200, alignItems: "center", color: BOTH }}>{g.both.length}</div>
            <div style={{ display: "flex", marginTop: 6, fontSize: 38, color: "rgba(255,255,255,0.9)" }}>
              {g.both.length === 1 ? "country we've both explored" : "countries we've both explored"}
            </div>
            <div style={{ display: "flex", marginTop: 16, fontSize: 42 }}>
              {sharedFlags}
              {more > 0 && <span style={{ fontSize: 34, marginLeft: 14, color: "rgba(255,255,255,0.7)" }}>+{more}</span>}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 40 }}>
            <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 76 }}>No country in common</div>
            <div style={{ display: "flex", marginTop: 12, fontSize: 40, color: "rgba(255,255,255,0.8)" }}>Our next trip, together?</div>
          </div>
        )}

        {/* Both your worlds on one globe */}
        <svg width={G} height={G} viewBox={`0 0 ${G} ${G}`} style={{ marginTop: 22 }}>
          <defs>
            <radialGradient id="ocean" cx="40%" cy="30%" r="75%">
              <stop offset="0" stopColor="#2a2060" />
              <stop offset="0.7" stopColor="#130d33" />
              <stop offset="1" stopColor="#0a0720" />
            </radialGradient>
          </defs>
          <circle cx={globe.disc.cx} cy={globe.disc.cy} r={globe.disc.r + 10} fill="rgba(245,194,66,0.14)" />
          <circle cx={globe.disc.cx} cy={globe.disc.cy} r={globe.disc.r} fill="url(#ocean)" />
          <g>
            <path d={globe.land} fill="#2c2a63" stroke="#41408a" strokeWidth={1} />
            {globe.lit.map((c) => (
              <path key={c.code} d={c.d} fill={colorOf(c.code)} stroke="rgba(255,255,255,0.55)" strokeWidth={1} />
            ))}
          </g>
        </svg>

        {/* What each of you could show the other */}
        <div style={{ display: "flex", justifyContent: "space-between", width: 920, marginTop: 22 }}>
          <Side color={MINE} n={g.onlyMine.length} label={`Only ${me.name}`} codes={g.onlyMine} />
          <Side color={THEIRS} n={g.onlyTheirs.length} label={`Only ${peer.name}`} codes={g.onlyTheirs} />
        </div>

        {/* How alike your worlds are */}
        <div style={{ display: "flex", alignItems: "center", marginTop: 26, padding: "14px 32px", borderRadius: 999, background: "rgba(245,194,66,0.14)", border: "2px solid rgba(245,194,66,0.5)" }}>
          <div style={{ display: "flex", fontSize: 34, color: "rgba(255,255,255,0.85)" }}>Travel match</div>
          <div style={{ display: "flex", width: 240, height: 14, marginLeft: 22, marginRight: 22, borderRadius: 999, background: "rgba(255,255,255,0.15)" }}>
            <div style={{ display: "flex", width: `${Math.max(4, match)}%`, height: 14, borderRadius: 999, background: "linear-gradient(90deg, #fa51a2, #f5c242)" }} />
          </div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 600, color: BOTH }}>{match}%</div>
        </div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 28, color: "rgba(255,255,255,0.6)" }}>
          Together: {g.together} {g.together === 1 ? "country" : "countries"} · World Connect on ExpandiaX
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      emoji: "twemoji",
      fonts: fonts.length ? fonts : undefined,
      headers: { "Cache-Control": "private, max-age=600" },
    }
  );
}

import "server-only";
import { ImageResponse } from "next/og";
import { countryByCode } from "./countries";
import { fraunces } from "./momentImage";
import type { Inviter } from "./inviteCard";

const FLAGS = 9;

/** Inter, the app's own text face, at one weight (TrueType from Google Fonts); null if that fails. */
async function inter(weight: 400 | 700): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Inter:wght@${weight}`, { cache: "force-cache" })).text();
    const url = css.match(/src: url\((https:[^)]+\.ttf)\)/)?.[1];
    return url ? await (await fetch(url, { cache: "force-cache" })).arrayBuffer() : null;
  } catch {
    return null;
  }
}

/**
 * The picture under an invite link in WhatsApp (and Messenger, iMessage…):
 * "An invitation from Mark", their photo, their world in numbers and flags,
 * and "Join Mark". Flat colour on purpose: it stays light enough (well under
 * WhatsApp's ~300 KB) for the big preview to show.
 */
export async function inviteImage(inviter: Inviter | null) {
  const [font, regular, bold] = await Promise.all([fraunces(), inter(400), inter(700)]);
  const serif = font ? "Fraunces" : "serif";
  const first = inviter?.first ?? "A friend";
  const name = inviter?.name ?? "A friend";
  const countries = inviter?.codes.length ?? 0;
  const flags = (inviter?.codes ?? []).slice(0, FLAGS).map((c) => countryByCode(c)?.flag).filter(Boolean) as string[];
  const more = countries - flags.length;
  const hasWorld = countries > 0 || (inviter?.events ?? 0) > 0;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#2b0b2e", color: "white", fontFamily: "Inter" }}>
        {/* Two soft glows in the brand colours */}
        <div style={{ position: "absolute", left: -220, top: -260, width: 760, height: 760, borderRadius: 760, display: "flex", background: "radial-gradient(circle, rgba(250,81,162,0.45) 0%, rgba(250,81,162,0) 65%)" }} />
        <div style={{ position: "absolute", right: -260, bottom: -320, width: 820, height: 820, borderRadius: 820, display: "flex", background: "radial-gradient(circle, rgba(251,120,34,0.35) 0%, rgba(251,120,34,0) 65%)" }} />

        <div style={{ position: "relative", display: "flex", width: "100%", padding: "60px 68px", justifyContent: "space-between" }}>
          {/* Who's inviting, and their world */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 640 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <div style={{ display: "flex", padding: 5, borderRadius: 70, background: "linear-gradient(135deg, #fa51a2, #fb7822)" }}>
                {inviter?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={inviter.avatar} alt="" width={118} height={118} style={{ borderRadius: 59, border: "4px solid #2b0b2e", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 118, height: 118, borderRadius: 59, border: "4px solid #2b0b2e", background: "#4a1450", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, fontFamily: serif }}>
                    {first.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 22, letterSpacing: 5, textTransform: "uppercase", color: "#ffb3d6" }}>An invitation from</div>
                <div style={{ display: "flex", fontSize: name.length > 16 ? 50 : 62, lineHeight: 1.05, fontFamily: serif, marginTop: 4 }}>{name}</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", fontSize: 44, lineHeight: 1.15, fontFamily: serif }}>
                {hasWorld ? `Come see ${first}'s world, and start your own.` : `Keep your travels and memories, together with ${first}.`}
              </div>
              {flags.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {flags.map((f, i) => (
                    <div key={i} style={{ display: "flex", fontSize: 46 }}>
                      {f}
                    </div>
                  ))}
                  {more > 0 && (
                    <div style={{ display: "flex", marginLeft: 6, fontSize: 26, fontWeight: 700, color: "#2b0b2e", background: "#ffb3d6", borderRadius: 999, padding: "6px 16px" }}>+{more}</div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
              <div style={{ display: "flex", fontSize: 38, fontFamily: serif }}>
                <span style={{ color: "#fb8a4e" }}>Expandia</span>
                <span style={{ color: "#fa51a2" }}>X</span>
              </div>
              <div style={{ display: "flex", fontSize: 24, color: "rgba(255,255,255,0.7)" }}>Your world, remembered.</div>
            </div>
          </div>

          {/* Their world in numbers, and the way in */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: 360 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: 340,
                padding: "40px 24px 34px",
                borderRadius: 36,
                background: "rgba(255,255,255,0.07)",
                border: "2px solid rgba(255,255,255,0.14)",
              }}
            >
              {hasWorld ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ display: "flex", fontSize: 128, lineHeight: 1, fontFamily: serif, color: "#fa51a2" }}>{countries || inviter?.events}</div>
                  <div style={{ display: "flex", fontSize: 30, marginTop: 8, fontWeight: 700 }}>
                    {countries ? (countries === 1 ? "country" : "countries") : inviter?.events === 1 ? "event" : "events"}
                  </div>
                  <div style={{ display: "flex", fontSize: 22, marginTop: 8, color: "rgba(255,255,255,0.65)" }}>
                    {[
                      countries && inviter?.continents ? `${inviter.continents} ${inviter.continents === 1 ? "continent" : "continents"}` : null,
                      countries && inviter?.events ? `${inviter.events} ${inviter.events === 1 ? "event" : "events"}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "and counting"}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", fontSize: 40, lineHeight: 1.15, textAlign: "center", fontFamily: serif }}>Countries, events, memories.</div>
              )}
              <div
                style={{
                  display: "flex",
                  marginTop: 30,
                  fontSize: 28,
                  fontWeight: 700,
                  color: "white",
                  background: "linear-gradient(90deg, #fa51a2, #fb7822)",
                  borderRadius: 999,
                  padding: "16px 36px",
                }}
              >
                Join {first}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      emoji: "twemoji",
      fonts: [
        ...(regular ? [{ name: "Inter", data: regular, weight: 400 as const, style: "normal" as const }] : []),
        ...(bold ? [{ name: "Inter", data: bold, weight: 700 as const, style: "normal" as const }] : []),
        ...(font ? [{ name: "Fraunces", data: font, weight: 600 as const, style: "normal" as const }] : []),
      ],
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    }
  );
}

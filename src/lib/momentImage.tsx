import "server-only";
import { ImageResponse } from "next/og";

/** Fraunces for the title, as on the site (Google Fonts hands out TrueType to a plain request); the default font if that fails. */
async function fraunces(): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Fraunces:wght@600", { cache: "force-cache" })).text();
    const url = css.match(/src: url\((https:[^)]+\.ttf)\)/)?.[1];
    return url ? await (await fetch(url, { cache: "force-cache" })).arrayBuffer() : null;
  } catch {
    return null;
  }
}

/**
 * The cover, made tiny (Next's image optimiser) and stretched back out: the
 * picture in the link preview is soft and blurred, so the photos stay a
 * surprise until they join.
 */
async function blurredCover(origin: string, cover: string | null): Promise<string | null> {
  if (!cover) return null;
  try {
    const res = await fetch(`${origin}/_next/image?url=${encodeURIComponent(cover)}&w=32&q=60`, { headers: { Accept: "image/jpeg,image/png" } });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!/jpe?g|png/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export type ImageMoment = { ownerName: string; ownerAvatar: string | null; title: string; when: string; place: string; photos: number; cover: string | null } | null;

/** The link preview of a trip or event someone was added to: 1200×630, the cover blurred behind "Unlock this memory". */
export async function momentImage(origin: string, moment: ImageMoment) {
  const [bg, font] = await Promise.all([blurredCover(origin, moment?.cover ?? null), fraunces()]);
  const first = (moment?.ownerName ?? "A friend").trim().split(" ")[0];
  const title = moment?.title ?? "A shared memory";
  const line = moment ? [moment.when, moment.place].filter(Boolean).join(" · ") : "";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#2b0b2e", color: "white", fontFamily: "sans-serif" }}>
        {bg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bg} alt="" width={1200} height={630} style={{ position: "absolute", left: 0, top: 0, width: 1200, height: 630, objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", background: "radial-gradient(120% 90% at 25% 15%, #fa51a2 0%, #6e1e6a 45%, #2b0b2e 100%)" }} />
        )}
        <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(180deg, rgba(43,11,46,0.35) 0%, rgba(43,11,46,0.55) 45%, rgba(43,11,46,0.92) 100%)" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", padding: "56px 64px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              {moment?.ownerAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={moment.ownerAvatar} alt="" width={76} height={76} style={{ borderRadius: 38, border: "4px solid rgba(255,255,255,0.85)", objectFit: "cover" }} />
              ) : (
                <div style={{ width: 76, height: 76, borderRadius: 38, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>{first.charAt(0)}</div>
              )}
              <div style={{ display: "flex", fontSize: 34, fontWeight: 600 }}>{first} wants to share a memory with you</div>
            </div>
            <div style={{ display: "flex", fontSize: 30, fontFamily: font ? "Fraunces" : "serif" }}>
              <span style={{ color: "#fb8a4e" }}>Expandia</span>
              <span style={{ color: "#fa51a2" }}>X</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", fontSize: 24, letterSpacing: 5, textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}>You were part of this memory</div>
            <div style={{ display: "flex", fontSize: title.length > 22 ? 76 : 96, lineHeight: 1.02, fontFamily: font ? "Fraunces" : "serif" }}>{title}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <div style={{ display: "flex", fontSize: 30, color: "rgba(255,255,255,0.85)" }}>
                {line}
                {moment?.photos ? ` · ${moment.photos} photos waiting` : ""}
              </div>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#2b0b2e", background: "linear-gradient(90deg, #fa51a2, #fb7822)", borderRadius: 999, padding: "16px 34px" }}>
                Unlock this memory
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: font ? [{ name: "Fraunces", data: font, weight: 600, style: "normal" }] : undefined,
      headers: { "Cache-Control": "public, max-age=3600" },
    }
  );
}

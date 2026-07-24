import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { eventTypeMeta } from "@/lib/events";
import { countryPathD } from "@/lib/countryShape";
import { flagGradientColors } from "@/lib/flagColors";

const SIZE = { width: 1080, height: 1920 };
const SHAPE_SIZE = 820;
const MEDALLION = 380;

type CardData = {
  photoUrl: string | undefined;
  countryCode: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  author: string;
  username: string;
};

function Wordmark() {
  return (
    <div
      style={{
        display: "flex",
        alignSelf: "flex-start",
        alignItems: "center",
        padding: "10px 20px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.32)",
        fontSize: 32,
        fontWeight: 700,
        color: "white",
      }}
    >
      <span>Expandia</span>
      <span style={{ color: "#ffb199" }}>X</span>
    </div>
  );
}

function TextBlock({ eyebrow, title, subtitle, author, username }: Omit<CardData, "photoUrl" | "countryCode">) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "28px 32px",
        borderRadius: 28,
        background: "rgba(0,0,0,0.38)",
        color: "white",
      }}
    >
      {eyebrow && (
        <div style={{ display: "flex", fontSize: 24, fontWeight: 600, letterSpacing: 4, opacity: 0.85 }}>
          {eyebrow.toUpperCase()}
        </div>
      )}
      <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.08 }}>{title}</div>
      {subtitle && <div style={{ display: "flex", fontSize: 32, opacity: 0.9 }}>{subtitle}</div>}
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 6 }}>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 600 }}>{author}</div>
        <div style={{ display: "flex", fontSize: 24, opacity: 0.75 }}>@{username}</div>
      </div>
    </div>
  );
}

/** The full design: the country's real geographic outline as a stage, a
 *  circular medallion of the memory's cover photo centered on it, floating
 *  on a gradient built from that country's flag colors.
 *
 *  Note: Satori (next/og's renderer) doesn't support clip-path referencing a
 *  custom SVG path on <img>, nor <image>+<clipPath> inside raw <svg> — both
 *  were tried and confirmed silently no-op / drop the image. The medallion
 *  is the closest achievable "photo + country shape" composition using only
 *  primitives Satori actually supports (border-radius circle crop + a
 *  separately-drawn outline stroke). */
function renderShapedCard(data: CardData) {
  const [c1, c2] = flagGradientColors(data.countryCode);
  const meta = countryByCode(data.countryCode);
  const pathD = countryPathD(meta?.numeric, SHAPE_SIZE);
  if (!pathD) throw new Error("no shape data for this country");

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 56px",
          background: `linear-gradient(160deg, ${c1} 0%, ${c2} 100%)`,
          fontFamily: "sans-serif",
        }}
      >
        <Wordmark />

        <div style={{ display: "flex", position: "relative", width: SHAPE_SIZE, height: SHAPE_SIZE, alignSelf: "center" }}>
          <svg
            width={SHAPE_SIZE}
            height={SHAPE_SIZE}
            viewBox={`0 0 ${SHAPE_SIZE} ${SHAPE_SIZE}`}
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            <path d={pathD} fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.85)" strokeWidth={6} />
          </svg>
          {data.photoUrl && (
            <div
              style={{
                display: "flex",
                position: "absolute",
                top: (SHAPE_SIZE - MEDALLION) / 2,
                left: (SHAPE_SIZE - MEDALLION) / 2,
                width: MEDALLION,
                height: MEDALLION,
                borderRadius: "50%",
                border: "10px solid white",
                overflow: "hidden",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.photoUrl}
                alt=""
                width={MEDALLION}
                height={MEDALLION}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          )}
        </div>

        <TextBlock {...data} />
      </div>
    ),
    { ...SIZE }
  );
}

/** Always-works fallback: full-bleed cover photo with a brand gradient scrim. */
function renderFallbackCard(data: CardData) {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #ff6347 0%, #f59e0b 55%, #0d9488 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {data.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.photoUrl}
            alt=""
            width={SIZE.width}
            height={SIZE.height}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 32%, rgba(0,0,0,0.82) 100%)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "64px 56px",
            color: "white",
          }}
        >
          <div style={{ display: "flex", fontSize: 36, fontWeight: 700 }}>
            <span>Expandia</span>
            <span style={{ color: "#ffb199" }}>X</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {data.eyebrow && (
              <div style={{ display: "flex", fontSize: 26, fontWeight: 600, letterSpacing: 4, opacity: 0.85 }}>
                {data.eyebrow.toUpperCase()}
              </div>
            )}
            <div style={{ display: "flex", fontSize: 74, fontWeight: 700, lineHeight: 1.08 }}>{data.title}</div>
            {data.subtitle && <div style={{ display: "flex", fontSize: 34, opacity: 0.9 }}>{data.subtitle}</div>}
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 20 }}>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 600 }}>{data.author}</div>
              <div style={{ display: "flex", fontSize: 26, opacity: 0.75 }}>@{data.username}</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...SIZE }
  );
}

function renderCard(data: CardData) {
  try {
    return renderShapedCard(data);
  } catch {
    return renderFallbackCard(data);
  }
}

export async function GET(_req: NextRequest, { params }: { params: { kind: string; id: string } }) {
  const { kind, id } = params;
  if (kind !== "country" && kind !== "event") {
    return new Response("Not found", { status: 404 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  if (kind === "country") {
    const { data } = await supabase
      .from("visited_countries")
      .select(
        "country_code, country_name, cover_media_id, user_id, country_media!country_media_visited_country_id_fkey(id, public_url, media_type, display_order), country_visits(year)"
      )
      .eq("id", id)
      .maybeSingle();
    if (!data) return new Response("Not found", { status: 404 });
    if (data.user_id !== user.id) return new Response("Forbidden", { status: 403 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", data.user_id)
      .single();

    const meta = countryByCode(data.country_code);
    const images = data.country_media.filter((m) => m.media_type === "image");
    const cover = images.find((m) => m.id === data.cover_media_id) ?? [...images].sort((a, b) => a.display_order - b.display_order)[0];
    const years = [...new Set(data.country_visits.map((v) => v.year))].sort();

    return renderCard({
      photoUrl: cover?.public_url,
      countryCode: data.country_code,
      eyebrow: meta?.continent ?? "",
      title: `${meta?.flag ?? ""} ${data.country_name}`,
      subtitle: years.join(" · "),
      author: profile?.display_name ?? "",
      username: profile?.username ?? "",
    });
  }

  const { data } = await supabase
    .from("events")
    .select(
      "title, subtitle, venue, city, country_code, country_name, event_type, cover_media_id, user_id, event_media!event_media_event_id_fkey(id, public_url, media_type, display_order)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return new Response("Not found", { status: 404 });
  if (data.user_id !== user.id) return new Response("Forbidden", { status: 403 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", data.user_id)
    .single();

  const images = data.event_media.filter((m) => m.media_type === "image");
  const cover = images.find((m) => m.id === data.cover_media_id) ?? [...images].sort((a, b) => a.display_order - b.display_order)[0];
  const typeMeta = eventTypeMeta(data.event_type);

  return renderCard({
    photoUrl: cover?.public_url,
    countryCode: data.country_code,
    eyebrow: typeMeta.label,
    title: data.title,
    subtitle: [data.venue, data.city, data.country_name].filter(Boolean).join(", "),
    author: profile?.display_name ?? "",
    username: profile?.username ?? "",
  });
}

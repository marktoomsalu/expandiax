import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { eventTypeMeta } from "@/lib/events";

const SIZE = { width: 1080, height: 1920 };

type CardData = {
  photoUrl: string | undefined;
  eyebrow: string;
  title: string;
  subtitle: string;
  author: string;
  username: string;
};

function renderCard({ photoUrl, eyebrow, title, subtitle, author, username }: CardData) {
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
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
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
            {eyebrow && (
              <div style={{ display: "flex", fontSize: 26, fontWeight: 600, letterSpacing: 4, opacity: 0.85 }}>
                {eyebrow.toUpperCase()}
              </div>
            )}
            <div style={{ display: "flex", fontSize: 74, fontWeight: 700, lineHeight: 1.08 }}>{title}</div>
            {subtitle && <div style={{ display: "flex", fontSize: 34, opacity: 0.9 }}>{subtitle}</div>}
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 20 }}>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 600 }}>{author}</div>
              <div style={{ display: "flex", fontSize: 26, opacity: 0.75 }}>@{username}</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...SIZE }
  );
}

export async function GET(_req: NextRequest, { params }: { params: { kind: string; id: string } }) {
  const { kind, id } = params;
  if (kind !== "country" && kind !== "event") {
    return new Response("Not found", { status: 404 });
  }

  const supabase = createClient();

  if (kind === "country") {
    const { data } = await supabase
      .from("visited_countries")
      .select(
        "country_code, country_name, cover_media_id, user_id, country_media!country_media_visited_country_id_fkey(id, public_url, media_type, display_order), country_visits(year)"
      )
      .eq("id", id)
      .maybeSingle();
    if (!data) return new Response("Not found", { status: 404 });

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
      "title, subtitle, venue, city, country_name, event_type, cover_media_id, user_id, event_media!event_media_event_id_fkey(id, public_url, media_type, display_order)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return new Response("Not found", { status: 404 });

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
    eyebrow: typeMeta.label,
    title: data.title,
    subtitle: [data.venue, data.city, data.country_name].filter(Boolean).join(", "),
    author: profile?.display_name ?? "",
    username: profile?.username ?? "",
  });
}

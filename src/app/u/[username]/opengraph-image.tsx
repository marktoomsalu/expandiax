import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { TOTAL_COUNTRIES } from "@/lib/countries";

export const alt = "ExpandiaX profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { username: string } }) {
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", params.username.toLowerCase())
    .maybeSingle();

  let countryCount = 0;
  let eventCount = 0;
  if (profile) {
    const [{ count: cc }, { count: kc }] = await Promise.all([
      supabase.from("visited_countries").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
      supabase.from("events").select("*", { count: "exact", head: true }).eq("user_id", profile.id).eq("is_public", true),
    ]);
    countryCount = cc ?? 0;
    eventCount = kc ?? 0;
  }

  const name = profile?.display_name ?? params.username;
  const pct = Math.round((countryCount / TOTAL_COUNTRIES) * 100);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #ff6347 0%, #f59e0b 55%, #0d9488 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              width={110}
              height={110}
              style={{ borderRadius: "50%", border: "4px solid rgba(255,255,255,0.85)", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: 110,
                height: 110,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 48,
                fontWeight: 700,
              }}
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1 }}>{name}</div>
            <div style={{ fontSize: 28, opacity: 0.85, marginTop: 4 }}>@{profile?.username ?? params.username}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 56 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 60, fontWeight: 700 }}>{countryCount}</div>
            <div style={{ fontSize: 24, opacity: 0.85 }}>of {TOTAL_COUNTRIES} countries ({pct}%)</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 60, fontWeight: 700 }}>{eventCount}</div>
            <div style={{ fontSize: 24, opacity: 0.85 }}>events</div>
          </div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 600, opacity: 0.9 }}>ExpandiaX</div>
      </div>
    ),
    { ...size }
  );
}

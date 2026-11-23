import type { NextRequest } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { renderConnectStory } from "@/lib/connectStory";
import { hasRealName } from "@/lib/profileName";
import type { GlobeCountry } from "@/lib/globeTouchLogic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Person = { username: string; display_name: string; avatar_url: string | null };
const first = (p: Person) => (hasRealName(p.display_name) ? p.display_name.trim().split(/\s+/)[0] : `@${p.username}`);

// Made-up people, for previews on a developer's computer only.
const DEMO = {
  me: { name: "Maria", avatar: null },
  peer: { name: "Alex", avatar: null },
  mine: ["EE", "FI", "LV", "SE", "IT", "ES", "FR", "GR", "HR", "PT", "US", "TH", "JP", "DE", "NO"].map((code) => ({ code, lived: false })),
  theirs: ["EE", "FI", "IT", "ES", "FR", "GB", "IE", "US", "MX", "JP", "VN", "DE", "NL", "MA"].map((code) => ({ code, lived: false })),
};

/**
 * World Connect as an Instagram Story picture (lib/connectStory). Asks the
 * server for the touch again, with the same codes the phone holds: only the
 * two people who touched phones get it, and only within the hour (as the
 * screen itself), with the countries each showed the other.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  if (q.get("demo") && process.env.NODE_ENV !== "production") return renderConnectStory(DEMO);

  const user = await getAuthUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const code = q.get("code") ?? "";
  const peerCode = q.get("peer") ?? "";
  if (!/^[0-9a-f]{32}$/.test(code) || !/^[0-9a-f]{32}$/.test(peerCode)) return new Response("Not found", { status: 404 });

  const supabase = createClient();
  const [{ data }, { data: me }] = await Promise.all([
    supabase.rpc("globe_touch", { p_code: code, p_peer_code: peerCode }),
    supabase.from("profiles").select("username, display_name, avatar_url").eq("id", user.id).single(),
  ]);
  const r = data as { peer: Person; peer_countries: GlobeCountry[]; my_countries: GlobeCountry[] } | null;
  if (!r || !me) return new Response("Not found", { status: 404 });

  return renderConnectStory({
    me: { name: first(me as Person), avatar: (me as Person).avatar_url },
    peer: { name: first(r.peer), avatar: r.peer.avatar_url },
    mine: r.my_countries,
    theirs: r.peer_countries,
  });
}

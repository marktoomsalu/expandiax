import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * The profile photo of the Google account they signed up with, for the
 * "Make it yours" step: handed to the page, not saved. It only becomes their
 * ExpandiaX photo if they keep it and continue (then it's uploaded like any
 * photo they'd pick). Google's own image servers only; Apple shares no photo.
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const raw = [meta.avatar_url, meta.picture].find((v): v is string => typeof v === "string" && !!v);
  if (!raw) return new NextResponse(null, { status: 404 });

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".googleusercontent.com")) return new NextResponse(null, { status: 404 });
  // Google sends a small one ("=s96-c"): ask for one big enough to look sharp.
  url.pathname = url.pathname.replace(/=s\d+(-c)?$/, "=s512-c");

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: "follow" });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) return new NextResponse(null, { status: 404 });
    const body = await res.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return new NextResponse(null, { status: 404 });
    return new NextResponse(body, { headers: { "Content-Type": type, "Cache-Control": "private, no-store" } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

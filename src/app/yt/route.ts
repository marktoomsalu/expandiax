import { NextResponse, type NextRequest } from "next/server";
import { CHANNELS, phoneOf, storeTarget } from "@/lib/storeLink";

export const dynamic = "force-dynamic";

/** expandiax.app/yt: the link in YouTube descriptions, comments and end screens. */
export function GET(request: NextRequest) {
  const ua = request.headers.get("user-agent");
  const target = storeTarget(ua, CHANNELS.yt);
  // A line per visit in the server logs: the channel and the kind of device.
  console.log(JSON.stringify({ go: "yt", phone: phoneOf(ua) ?? "other" }));
  return NextResponse.redirect(new URL(target, request.url), { status: 302, headers: { "Cache-Control": "no-store" } });
}

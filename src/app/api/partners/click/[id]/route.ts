import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { countPlacement } from "@/lib/sponsorsData";

export const dynamic = "force-dynamic";

/** A tap on a partner's placement: counted, then straight on to the partner's own page. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { data } = await createAdminClient().from("partner_placements").select("url").eq("id", params.id).maybeSingle();
  if (!data?.url) return NextResponse.redirect(new URL("/explore", req.url));
  await countPlacement(params.id, "click");
  return NextResponse.redirect(data.url as string, { status: 302 });
}

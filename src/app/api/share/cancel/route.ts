import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { shareUser } from "@/lib/shareTokens";

export const dynamic = "force-dynamic";

/** Cancelled in the share sheet: what was already sent is taken away again. */
export async function POST(request: NextRequest) {
  const userId = await shareUser(request);
  if (!userId) return NextResponse.json({ error: "signed-out" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { paths?: string[] } | null;
  const paths = (body?.paths ?? []).filter((p) => typeof p === "string" && p.startsWith(`${userId}/countries/shared-`)).slice(0, 60);
  if (paths.length) await createAdminClient().storage.from("media").remove(paths);
  return NextResponse.json({ ok: true });
}

import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { shareUser } from "@/lib/shareTokens";

export const dynamic = "force-dynamic";

const EXT: Record<string, string> = { image: "jpg", video: "mp4" };

/**
 * Places to upload to, one per photo or video. The share sheet asks the
 * moment it opens and starts sending while they're still choosing a trip,
 * so "Add" is nearly instant; nothing is attached to a trip until /finish,
 * and /cancel takes them away again.
 */
export async function POST(request: NextRequest) {
  const userId = await shareUser(request);
  if (!userId) return NextResponse.json({ error: "signed-out" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { kinds?: string[] } | null;
  const kinds = (body?.kinds ?? []).filter((k) => k === "image" || k === "video").slice(0, 60);
  if (!kinds.length) return NextResponse.json({ error: "Nothing to upload." }, { status: 400 });

  const bucket = createAdminClient().storage.from("media");
  const day = new Date().toISOString().slice(0, 10);
  const items = await Promise.all(
    kinds.map(async (kind) => {
      const path = `${userId}/countries/shared-${day}/${randomUUID()}.${EXT[kind]}`;
      const { data, error } = await bucket.createSignedUploadUrl(path);
      return error || !data ? null : { kind, path, url: data.signedUrl };
    })
  );
  if (items.some((i) => !i)) return NextResponse.json({ error: "Couldn't get ready to upload." }, { status: 500 });
  return NextResponse.json({ items });
}

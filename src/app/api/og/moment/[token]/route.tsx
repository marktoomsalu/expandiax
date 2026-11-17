import type { NextRequest } from "next/server";
import { loadMomentInvite } from "@/lib/momentInvites";
import { momentImage } from "@/lib/momentImage";

export const dynamic = "force-dynamic";

/**
 * The picture shown when a link to a trip or event (migration 078) is
 * pasted into WhatsApp, Messenger, iMessage…: "Mark wants to share a memory
 * with you", the trip over its blurred cover, and "Unlock this memory".
 */
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  return momentImage(req.nextUrl.origin, await loadMomentInvite(params.token));
}

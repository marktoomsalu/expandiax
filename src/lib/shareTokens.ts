// Share to ExpandiaX: the share key the iPhone share sheet signs in with
// (see migration 088). Server only.

import { createHash, randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** A new share key for this person: returned once, stored only as a hash. */
export async function createShareToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const { error } = await createAdminClient().from("share_tokens").insert({ user_id: userId, token_hash: hash(token) });
  if (error) throw new Error(error.message);
  return token;
}

const bearer = (request: NextRequest) => (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

/** Who a share key belongs to (null: no key, or not one we know). */
export async function shareUser(request: NextRequest): Promise<string | null> {
  const token = bearer(request);
  if (token.length < 20) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("share_tokens").select("id, user_id").eq("token_hash", hash(token)).maybeSingle();
  if (!data) return null;
  void admin.from("share_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
  return data.user_id as string;
}

/** Signing out on the phone: its key stops working. */
export async function revokeShareToken(request: NextRequest): Promise<void> {
  const token = bearer(request);
  if (token) await createAdminClient().from("share_tokens").delete().eq("token_hash", hash(token));
}

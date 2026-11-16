import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Invite links on a phone go straight to the App Store or Google Play, and
// neither passes anything on. So that the friend is still connected after
// installing, the click is noted as a fingerprint: a one-way hash of the
// network address and the phone's system (never the address itself), kept 24
// hours. Signing up on the same network and system soon after claims it
// (migration 072).

const HOURS = 24;

/** The phone's network and system, scrambled beyond recovery. On an iPhone the
 *  system is its iOS version; on Android just "android", because Chrome
 *  reports the same made-up Android version on every phone while the app
 *  reports the real one, so a version would never match. */
export function fingerprint(headers: Headers): string | null {
  const ip = (headers.get("x-forwarded-for") ?? headers.get("x-real-ip") ?? "").split(",")[0].trim();
  if (!ip) return null;
  const ua = headers.get("user-agent") ?? "";
  const system = /Android/.test(ua) ? "android" : ua.match(/OS (\d+[_\d]*) like Mac OS X/)?.[1] ?? "";
  const salt = process.env.INVITE_SALT ?? process.env.PUSH_WEBHOOK_SECRET ?? "expandiax";
  return createHash("sha256").update(`${salt}|${ip}|${system}`).digest("hex");
}

export async function noteInviteClick(inviterId: string, headers: Headers) {
  const fp = fingerprint(headers);
  if (!fp) return;
  await createAdminClient().from("invite_clicks").insert({ inviter_id: inviterId, fingerprint: fp });
}

/** Who invited this phone in the last day, if anyone (and forget the clicks). */
export async function claimInviteClick(headers: Headers): Promise<string | null> {
  const fp = fingerprint(headers);
  if (!fp) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invite_clicks")
    .select("inviter_id, profiles!invite_clicks_inviter_id_fkey(username)")
    .eq("fingerprint", fp)
    .gte("created_at", new Date(Date.now() - HOURS * 3_600_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  await admin.from("invite_clicks").delete().eq("fingerprint", fp);
  const p = (Array.isArray(data.profiles) ? data.profiles[0] : data.profiles) as { username?: string } | null;
  return p?.username ?? null;
}

/** Older than a day: gone (the weekly job). */
export async function pruneInviteClicks() {
  await createAdminClient().from("invite_clicks").delete().lt("created_at", new Date(Date.now() - HOURS * 3_600_000).toISOString());
}

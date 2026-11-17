import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { INVITE_COOKIE, MOMENT_COOKIE } from "@/lib/invite";
import { claimMomentInvite } from "@/lib/momentInvites";
import { claimInviteClick } from "@/lib/inviteClicks";

export const dynamic = "force-dynamic";

/**
 * Right after signing up: connect the new member with whoever invited them
 * (the join page's cookie, or a username they typed). See accept_invite,
 * migration 071. The cookie is cleared whatever happens.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ status: "signed_out" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { username?: string };
  // Typed, or the join page's cookie, or (installed from the App Store or Google Play
  // straight from an invite link) the click noted for this phone.
  let username = (body.username ?? decodeURIComponent(request.cookies.get(INVITE_COOKIE)?.value ?? "")).trim().replace(/^@/, "");
  // A link to a trip or event (migration 078): from the cookie, or kept with the phone's click.
  let moment = decodeURIComponent(request.cookies.get(MOMENT_COOKIE)?.value ?? "") || null;
  if (!username) {
    const click = await claimInviteClick(request.headers).catch(() => null);
    username = click?.username ?? "";
    moment = moment ?? click?.moment ?? null;
  }
  if (!username || !/^[\w.]{1,40}$/.test(username)) {
    // Nothing to claim. "none" (offer to type a friend's username) only for
    // new accounts that haven't been invited yet.
    const supabase = createClient();
    const [{ data: me }, { data: invited }] = await Promise.all([
      supabase.from("profiles").select("created_at").eq("id", user.id).maybeSingle(),
      supabase.from("invites").select("inviter_id").eq("invitee_id", user.id).maybeSingle(),
    ]);
    const fresh = me?.created_at && Date.now() - Date.parse(me.created_at as string) < 14 * 86_400_000;
    const res = NextResponse.json({ status: fresh && !invited ? "none" : "done" });
    res.cookies.delete(INVITE_COOKIE);
    return res;
  }
  const supabase = createClient();
  const { data, error } = await supabase.rpc("accept_invite", { p_inviter: username });
  let inviter: { username: string; display_name: string; avatar_url: string | null } | null = null;
  if (data === "ok" || data === "already") {
    const { data: p } = await supabase.from("profiles").select("username, display_name, avatar_url").eq("username", username.toLowerCase()).maybeSingle();
    inviter = p;
  }
  // The trip or event they were added to: now an invitation to choose from.
  if (moment && (data === "ok" || data === "already")) await claimMomentInvite(moment, user.id).catch(() => false);
  const res = NextResponse.json({ status: error ? "error" : data, inviter });
  res.cookies.delete(INVITE_COOKIE);
  res.cookies.delete(MOMENT_COOKIE);
  return res;
}

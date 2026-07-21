// Supabase Edge Function: emails a user when someone follows them.
//
// Deploy: supabase functions deploy notify-follow
// Secrets: supabase secrets set RESEND_API_KEY=re_your_key
// Wire it up: Supabase Dashboard -> Database -> Webhooks -> Create a new
// webhook -> table "follows", event "Insert", type "Supabase Edge Function",
// function "notify-follow". (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// provided automatically to every Edge Function — no need to set them.)

import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://expandiax.com";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const follow = payload.record as { follower_id: string; followee_id: string } | undefined;
    if (!follow) return new Response("ignored", { status: 200 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [{ data: follower }, { data: followee }, { data: followeeAuth }] = await Promise.all([
      supabase.from("profiles").select("username, display_name").eq("id", follow.follower_id).single(),
      supabase.from("profiles").select("username, display_name").eq("id", follow.followee_id).single(),
      supabase.auth.admin.getUserById(follow.followee_id),
    ]);

    const email = followeeAuth?.user?.email;
    if (!email || !follower || !followee || !RESEND_API_KEY) {
      return new Response("skipped: missing data or RESEND_API_KEY", { status: 200 });
    }

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ExpandiaX <notifications@expandiax.com>",
        to: email,
        subject: `${follower.display_name} started following you`,
        html: `
          <p>Hi ${followee.display_name},</p>
          <p><strong>${follower.display_name}</strong> (@${follower.username}) just started following your world on ExpandiaX.</p>
          <p><a href="${SITE_URL}/u/${follower.username}">See their profile</a></p>
        `,
      }),
    });

    return new Response("sent", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 });
  }
});

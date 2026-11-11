import { NextRequest, NextResponse } from "next/server";
import { adminId } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCampaign, type Audience, type PushCategory } from "@/lib/pushCampaigns";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Create an announcement: sent now, or saved for its time. Admins only. */
export async function POST(request: NextRequest) {
  const me = await adminId();
  if (!me) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const body = (await request.json()) as { title?: string; body?: string; link?: string; category?: PushCategory; audience?: Audience; sendAt?: string | null };
  const title = (body.title ?? "").trim();
  const text = (body.body ?? "").trim();
  if (!title || title.length > 80 || !text || text.length > 300) return NextResponse.json({ error: "Write a title (up to 80 characters) and a message (up to 300)." }, { status: 400 });
  const link = body.link?.startsWith("/") ? body.link.slice(0, 200) : "/feed";
  const category: PushCategory = body.category === "push_reminders" ? "push_reminders" : "push_updates";
  const audience: Audience = {
    ...(body.audience?.platform === "ios" || body.audience?.platform === "android" ? { platform: body.audience.platform } : {}),
    ...(body.audience?.country && /^[A-Za-z]{2}$/.test(body.audience.country) ? { country: body.audience.country.toUpperCase() } : {}),
    ...(body.audience?.activeDays && body.audience.activeDays > 0 ? { activeDays: Math.min(365, Math.round(body.audience.activeDays)) } : {}),
  };
  const sendAt = body.sendAt ? new Date(body.sendAt) : null;
  if (sendAt && Number.isNaN(sendAt.getTime())) return NextResponse.json({ error: "That time isn't valid." }, { status: 400 });
  const later = !!sendAt && sendAt.getTime() > Date.now() + 60_000;

  const admin = createAdminClient();
  const { data: created, error } = await admin
    .from("push_campaigns")
    .insert({ title, body: text, link, category, audience, send_at: (later ? sendAt! : new Date()).toISOString(), created_by: me })
    .select("id")
    .single();
  if (error || !created) return NextResponse.json({ error: "Couldn't save it. Try again." }, { status: 500 });
  if (later) return NextResponse.json({ ok: true, scheduled: true, id: created.id });
  const result = await sendCampaign(admin, created.id);
  if (!result) return NextResponse.json({ error: "It didn't go out. See History for why." }, { status: 500 });
  return NextResponse.json({ ok: true, id: created.id, ...result });
}

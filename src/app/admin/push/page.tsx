import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { adminId } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDueCampaigns } from "@/lib/pushCampaigns";
import { PushComposer } from "@/components/admin/PushComposer";
import { PushHistory, type CampaignRow } from "@/components/admin/PushHistory";
import { PushTemplates, type TemplateRow } from "@/components/admin/PushTemplates";

export const metadata = { title: "Push notifications" };
export const dynamic = "force-dynamic";

/** Announcements, the automatic notifications' words, and how it all went. Admins only. */
export default async function AdminPushPage() {
  if (!(await adminId())) notFound();
  const admin = createAdminClient();
  // Anything overdue goes out now (besides the five-minute schedule).
  await sendDueCampaigns(admin).catch(() => 0);

  const [{ data: campaignRows }, { data: templateRows }, { count: devices }] = await Promise.all([
    admin.from("push_campaigns").select("id, title, body, link, category, audience, status, send_at, sent_at, recipients, delivered, failed, error").order("send_at", { ascending: false }).limit(50),
    admin.from("push_templates").select("kind, title, body, enabled").order("kind"),
    admin.from("device_tokens").select("token", { count: "exact", head: true }),
  ]);
  const ids = (campaignRows ?? []).map((c) => c.id as string);
  const { data: opens } = ids.length
    ? await admin.from("push_deliveries").select("campaign_id").in("campaign_id", ids).not("opened_at", "is", null).limit(100000)
    : { data: [] as { campaign_id: string }[] };
  const openedBy = new Map<string, number>();
  for (const o of opens ?? []) openedBy.set(o.campaign_id as string, (openedBy.get(o.campaign_id as string) ?? 0) + 1);
  const campaigns = (campaignRows ?? []).map((c) => ({ ...c, opened: openedBy.get(c.id as string) ?? 0 })) as CampaignRow[];
  const scheduled = campaigns.filter((c) => c.status === "scheduled").sort((a, b) => a.send_at.localeCompare(b.send_at));
  const history = campaigns.filter((c) => c.status !== "scheduled");

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Admin
      </Link>
      <h1 className="mt-3 text-3xl">Push notifications</h1>
      <p className="mt-1 text-sm text-muted">{devices ?? 0} phones can get notifications right now.</p>

      <section aria-labelledby="new-h" className="mt-8">
        <h2 id="new-h" className="font-serif text-xl">New announcement</h2>
        <div className="mt-4">
          <PushComposer />
        </div>
      </section>

      {scheduled.length > 0 && (
        <section aria-labelledby="sched-h" className="mt-10">
          <h2 id="sched-h" className="font-serif text-xl">Scheduled</h2>
          <div className="mt-3">
            <PushHistory campaigns={scheduled} />
          </div>
        </section>
      )}

      <section aria-labelledby="hist-h" className="mt-10">
        <h2 id="hist-h" className="font-serif text-xl">History</h2>
        <div className="mt-3">
          <PushHistory campaigns={history} />
        </div>
      </section>

      <section aria-labelledby="auto-h" className="mt-10">
        <h2 id="auto-h" className="font-serif text-xl">Automatic notifications</h2>
        <p className="mt-1 text-sm text-muted">Sent the moment something happens. Change what they say, or switch one off for everyone.</p>
        <div className="mt-4">
          {(templateRows ?? []).length ? (
            <PushTemplates templates={(templateRows ?? []) as TemplateRow[]} />
          ) : (
            <p className="text-sm text-muted">Run migration 067 to manage these here.</p>
          )}
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { adminId } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDueCampaigns } from "@/lib/pushCampaigns";
import { PushComposer } from "@/components/admin/PushComposer";
import { PushHistory, type CampaignRow } from "@/components/admin/PushHistory";
import { PushTemplates, type TemplateRow } from "@/components/admin/PushTemplates";
import { PushRules } from "@/components/admin/PushRules";
import { loadRules } from "@/lib/pushDelivery";

const LEVELS = [
  { p: 1, label: "P1 · Messages" },
  { p: 2, label: "P2 · Followers" },
  { p: 3, label: "P3 · Comments and replies" },
  { p: 4, label: "P4 · Likes" },
  { p: 5, label: "P5 · Memory reminders" },
  { p: 6, label: "P6 · Announcements" },
];
const REASONS: Record<string, string> = {
  viewing: "already looking at it",
  switched_off: "switched off here",
  android_keeps_first: "Android keeps the first",
  not_delivered: "phone unreachable",
};
type LogRow = { priority: number; outcome: string; reason: string | null; opened_at: string | null };

export const metadata = { title: "Push notifications" };
export const dynamic = "force-dynamic";

/** Announcements, the automatic notifications' words, and how it all went. Admins only. */
export default async function AdminPushPage() {
  if (!(await adminId())) notFound();
  const admin = createAdminClient();
  // Anything overdue goes out now (besides the five-minute schedule).
  await sendDueCampaigns(admin).catch(() => 0);

  const [{ data: campaignRows }, { data: templateRows }, { count: devices }, rules, logRes] = await Promise.all([
    admin.from("push_campaigns").select("*").order("send_at", { ascending: false }).limit(50),
    admin.from("push_templates").select("kind, title, body, enabled").order("kind"),
    admin.from("device_tokens").select("token", { count: "exact", head: true }),
    loadRules(admin),
    admin.from("push_log").select("priority, outcome, reason, opened_at").gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()).limit(100000),
  ]);
  // The last 7 days, per priority: buzzed, silent, updated in place, held back; and opened.
  const log = (logRes.error ? [] : logRes.data ?? []) as LogRow[];
  const stats = LEVELS.map((l) => {
    const rows = log.filter((r) => r.priority === l.p);
    const shown = rows.filter((r) => r.outcome === "sent" || r.outcome === "silent");
    return {
      ...l,
      sent: rows.filter((r) => r.outcome === "sent").length,
      silent: rows.filter((r) => r.outcome === "silent").length,
      updated: rows.filter((r) => r.outcome === "updated").length,
      skipped: rows.filter((r) => r.outcome === "skipped").length,
      openRate: shown.length ? Math.round((shown.filter((r) => r.opened_at).length / shown.length) * 100) : null,
    };
  });
  const reasons = new Map<string, number>();
  for (const r of log) if (r.outcome === "skipped" && r.reason) reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1);
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

      <section aria-labelledby="stats-h" className="mt-10">
        <h2 id="stats-h" className="font-serif text-xl">The last 7 days</h2>
        <p className="mt-1 text-sm text-muted">Every notification, by priority: how many buzzed, came in silently (quiet hours), joined one already there instead of buzzing again, or were held back.</p>
        {logRes.error ? (
          <p className="mt-3 text-sm text-muted">Run migration 068 to see these.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-medium">Kind</th>
                  <th className="px-3 py-2 text-right font-medium">Buzzed</th>
                  <th className="px-3 py-2 text-right font-medium">Silent</th>
                  <th className="px-3 py-2 text-right font-medium">Grouped</th>
                  <th className="px-3 py-2 text-right font-medium">Held back</th>
                  <th className="px-4 py-2 text-right font-medium">Opened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stats.map((s) => (
                  <tr key={s.p}>
                    <td className="px-4 py-2">{s.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.sent}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.silent}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.updated}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.skipped}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.openRate === null ? "–" : `${s.openRate}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {reasons.size > 0 && (
          <p className="mt-2 text-xs text-muted">
            Held back: {[...reasons.entries()].map(([k, n]) => `${n} ${REASONS[k] ?? k}`).join(" · ")}
          </p>
        )}
      </section>

      <section aria-labelledby="rules-h" className="mt-10">
        <h2 id="rules-h" className="font-serif text-xl">Rules</h2>
        <p className="mt-1 text-sm text-muted">Social notifications always come first. Messages, followers, comments and likes go out straight away (grouped); reminders and announcements adapt to how active each person is.</p>
        <div className="mt-4">
          <PushRules initial={rules} />
        </div>
      </section>

      <section aria-labelledby="auto-h" className="mt-10">
        <h2 id="auto-h" className="font-serif text-xl">Automatic notifications</h2>
        <p className="mt-1 text-sm text-muted">Change what they say, or switch one off for everyone.</p>
        <div className="mt-4">
          {(templateRows ?? []).length ? (
            <PushTemplates templates={(templateRows ?? []) as TemplateRow[]} />
          ) : (
            <p className="text-sm text-muted">Run migrations 067 and 068 to manage these here.</p>
          )}
        </div>
      </section>
    </div>
  );
}

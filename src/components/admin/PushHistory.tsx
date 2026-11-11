"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type CampaignRow = {
  id: string;
  title: string;
  body: string;
  link: string;
  category: string;
  audience: { platform?: string; country?: string; activeDays?: number };
  status: string;
  send_at: string;
  sent_at: string | null;
  recipients: number;
  delivered: number;
  failed: number;
  /** Waiting for their morning (quiet hours when it went out). */
  waiting?: number;
  opened: number;
  error: string | null;
};

const STATUS: Record<string, string> = { scheduled: "Scheduled", sending: "Sending", sent: "Sent", cancelled: "Cancelled", failed: "Failed" };

function audienceText(c: CampaignRow) {
  const parts = [c.category === "push_reminders" ? "Memory reminders" : "Updates & inspiration"];
  if (c.audience?.platform) parts.push(c.audience.platform === "ios" ? "iPhone" : "Android");
  if (c.audience?.country) parts.push(`from ${c.audience.country}`);
  if (c.audience?.activeDays) parts.push(`active in ${c.audience.activeDays} days`);
  return parts.join(" · ");
}

/** Scheduled announcements (cancel them) and what went out, with how it did. */
export function PushHistory({ campaigns }: { campaigns: CampaignRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function cancel(id: string) {
    setBusy(id);
    await fetch(`/api/admin/push/${id}`, { method: "DELETE" });
    setBusy(null);
    router.refresh();
  }

  if (!campaigns.length) return <p className="text-sm text-muted">Nothing sent yet.</p>;
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line">
      {campaigns.map((c) => {
        const openRate = c.delivered ? Math.round((c.opened / c.delivered) * 100) : 0;
        return (
          <li key={c.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-medium",
                  c.status === "sent" ? "bg-accent-soft text-accent" : c.status === "scheduled" ? "bg-raised text-ink" : c.status === "failed" ? "bg-red-700/10 text-red-700" : "bg-raised"
                )}
              >
                {STATUS[c.status] ?? c.status}
              </span>
              <span>{new Date(c.sent_at ?? c.send_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
              <span>· {audienceText(c)}</span>
              <span>· opens {c.link}</span>
            </div>
            <p className="mt-1 font-medium">{c.title}</p>
            <p className="text-sm text-muted">{c.body}</p>
            {c.status === "sent" && (
              <p className="mt-1.5 text-xs">
                <b>{c.recipients}</b> people · <b>{c.delivered}</b> delivered{c.failed ? <> · <b>{c.failed}</b> failed</> : null} · <b>{c.opened}</b> opened ({openRate}%){c.waiting ? <> · <b>{c.waiting}</b> waiting for their morning</> : null}
              </p>
            )}
            {c.status === "failed" && c.error && <p className="mt-1.5 text-xs text-red-700 dark:text-red-400">{c.error}</p>}
            {c.status === "scheduled" && (
              <button type="button" disabled={busy === c.id} onClick={() => void cancel(c.id)} className="mt-1.5 text-xs font-medium text-red-700 hover:underline dark:text-red-400">
                Cancel it
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

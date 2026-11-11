"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Send } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import { cn } from "@/lib/utils";

const LINKS = [
  { value: "/feed", label: "Feed" },
  { value: "/my-world", label: "My World" },
  { value: "/feed?tab=explore", label: "Explore" },
  { value: "/events", label: "Events" },
  { value: "/stats", label: "Stats" },
  { value: "/settings", label: "Settings" },
];

type Estimate = { people: number; skippedRecently: number; quietNow?: number } | null;

/** Write an announcement, see how it'll look, and send it now or later. */
export function PushComposer() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("/feed");
  const [category, setCategory] = useState<"push_updates" | "push_reminders">("push_updates");
  const [platform, setPlatform] = useState<"" | "ios" | "android">("");
  const [country, setCountry] = useState("");
  const [activeDays, setActiveDays] = useState(0);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [sendAt, setSendAt] = useState("");
  const [estimate, setEstimate] = useState<Estimate>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audience = { ...(platform ? { platform } : {}), ...(country ? { country } : {}), ...(activeDays ? { activeDays } : {}) };
  const audienceKey = JSON.stringify([category, audience]);

  // Who it would reach, kept up to date as the audience changes.
  useEffect(() => {
    let alive = true;
    setEstimate(null);
    const t = setTimeout(async () => {
      const res = await fetch("/api/admin/push/estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, audience }) });
      if (alive && res.ok) setEstimate(await res.json());
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [audienceKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/admin/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, link, category, audience, sendAt: when === "later" && sendAt ? new Date(sendAt).toISOString() : null }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setConfirming(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setResult(
      data.scheduled
        ? `Scheduled for ${new Date(sendAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.`
        : `Sent to ${data.recipients} ${data.recipients === 1 ? "person" : "people"} (${data.delivered} delivered${data.failed ? `, ${data.failed} failed` : ""}${data.waiting ? `, ${data.waiting} waiting for their morning` : ""}).`
    );
    setTitle("");
    setBody("");
    router.refresh();
  }

  const ready = title.trim() && body.trim() && (when === "now" || sendAt);
  const pill = (on: boolean) => cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", on ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div>
          <label htmlFor="push-title" className="mb-1 block text-sm font-medium">Title</label>
          <input id="push-title" className="field" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Merry Christmas from ExpandiaX 🎄" />
          <p className="mt-1 text-right text-[11px] text-muted">{title.length}/80</p>
        </div>
        <div>
          <label htmlFor="push-body" className="mb-1 block text-sm font-medium">Message</label>
          <textarea id="push-body" className="field min-h-24" maxLength={300} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Where did this year take you? Your 2026 in countries is ready." />
          <p className="mt-1 text-right text-[11px] text-muted">{body.length}/300</p>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">Tapping it opens</p>
          <div className="flex flex-wrap gap-1.5">
            {LINKS.map((l) => (
              <button key={l.value} type="button" onClick={() => setLink(l.value)} className={pill(link === l.value)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line p-4">
          <p className="text-sm font-medium">Who gets it</p>
          <p className="mt-0.5 text-xs text-muted">Only people who have this kind switched on in their Settings, within the daily limit for reminders and announcements, and never in their quiet hours.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setCategory("push_updates")} className={pill(category === "push_updates")}>Updates &amp; inspiration</button>
            <button type="button" onClick={() => setCategory("push_reminders")} className={pill(category === "push_reminders")}>Memory reminders</button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-muted">
              Phone
              <select className="field mt-1 !py-2" value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)}>
                <option value="">iPhone and Android</option>
                <option value="ios">iPhone only</option>
                <option value="android">Android only</option>
              </select>
            </label>
            <label className="text-xs text-muted">
              Home country
              <select className="field mt-1 !py-2" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">Any</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              Used the app
              <select className="field mt-1 !py-2" value={activeDays} onChange={(e) => setActiveDays(Number(e.target.value))}>
                <option value={0}>Any time</option>
                <option value={7}>In the last 7 days</option>
                <option value={30}>In the last 30 days</option>
                <option value={90}>In the last 90 days</option>
              </select>
            </label>
          </div>
          <p className="mt-3 text-sm" aria-live="polite">
            {estimate ? (
              <>
                <b>{estimate.people}</b> {estimate.people === 1 ? "person" : "people"} would get it now
                {estimate.skippedRecently > 0 && <span className="text-muted"> · {estimate.skippedRecently} skipped (had their share today)</span>}
                {!!estimate.quietNow && when === "now" && <span className="text-muted"> · {estimate.quietNow} in quiet hours get it in their morning</span>}
              </>
            ) : (
              <span className="text-muted">Counting…</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setWhen("now")} className={pill(when === "now")}>Send now</button>
          <button type="button" onClick={() => setWhen("later")} className={pill(when === "later")}>Schedule</button>
          {when === "later" && (
            <input type="datetime-local" className="field !w-auto !py-1.5" value={sendAt} min={new Date(Date.now() + 5 * 60_000 - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)} onChange={(e) => setSendAt(e.target.value)} aria-label="When to send" />
          )}
        </div>

        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
        {result && <p role="status" className="text-sm text-accent">{result}</p>}

        {!confirming ? (
          <button type="button" disabled={!ready || busy} onClick={() => setConfirming(true)} className="btn-accent">
            {when === "now" ? <Send size={16} /> : <Clock size={16} />}
            {when === "now" ? "Send" : "Schedule"}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
            <span>
              {when === "now" ? `Send to ${estimate?.people ?? "these"} people now?` : "Schedule this announcement?"} It can&rsquo;t be taken back once it&rsquo;s out.
            </span>
            <button type="button" onClick={() => void send()} disabled={busy} className="btn-accent !py-1.5 text-sm">
              {busy ? "Sending…" : "Yes"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-muted hover:text-ink">Cancel</button>
          </div>
        )}
      </div>

      {/* How it'll look on an iPhone's lock screen. */}
      <div>
        <p className="mb-2 text-sm font-medium">Preview</p>
        <div className="rounded-[2rem] bg-gradient-to-b from-[#3b1a52] via-[#7c1d6f] to-[#fb7822] p-4 pb-16 pt-10 shadow-inner">
          <p className="text-center font-sans text-5xl font-semibold text-white/90">9:41</p>
          <p className="mb-6 text-center text-xs text-white/70">Wednesday 24 December</p>
          <div className="rounded-2xl bg-white/80 p-3 shadow-lg backdrop-blur">
            <div className="flex items-start gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="flex justify-between text-[13px] font-semibold text-black">
                  <span className="truncate">{title || "Title"}</span>
                  <span className="ml-2 shrink-0 text-[11px] font-normal text-black/50">now</span>
                </p>
                <p className="line-clamp-4 text-[13px] leading-snug text-black/80">{body || "Your message appears here."}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

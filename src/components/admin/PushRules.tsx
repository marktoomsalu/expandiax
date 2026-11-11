"use client";

import { useState } from "react";
import { Switch } from "../Switch";
import { DEFAULT_RULES, type PushRules as Rules } from "@/lib/pushPolicy";

type NumberKey = { [K in keyof Rules]: Rules[K] extends number ? K : never }[keyof Rules];

const hours = Array.from({ length: 24 }, (_, h) => h);
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** The numbers behind every push: quiet hours, grouping, reminders, daily limits. */
export function PushRules({ initial }: { initial: Rules }) {
  const [r, setR] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const changed = JSON.stringify(r) !== JSON.stringify(saved);
  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => {
    setR((x) => ({ ...x, [k]: v }));
    setState("idle");
  };

  async function save() {
    setState("saving");
    const res = await fetch("/api/admin/push/rules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) });
    if (res.ok) {
      const next = (await res.json()).rules as Rules;
      setR(next);
      setSaved(next);
    }
    setState(res.ok ? "saved" : "error");
  }

  const num = (k: NumberKey, label: string, unit: string, min: number, max: number) => (
    <label className="flex items-center justify-between gap-3 py-2 text-sm">
      <span>{label}</span>
      <span className="flex shrink-0 items-center gap-1.5 text-muted">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          className="field !w-20 !py-1.5 text-right"
          value={r[k]}
          onChange={(e) => set(k, Number(e.target.value) as never)}
        />
        {unit}
      </span>
    </label>
  );
  const hourSelect = (k: NumberKey, label: string) => (
    <label className="flex items-center justify-between gap-3 py-2 text-sm">
      <span>{label}</span>
      <select className="field !w-28 !py-1.5" value={r[k]} onChange={(e) => set(k, Number(e.target.value) as never)}>
        {hours.map((h) => (
          <option key={h} value={h}>
            {hh(h)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <fieldset className="rounded-2xl border border-line p-4">
        <legend className="px-1 text-sm font-semibold">Quiet hours</legend>
        <p className="text-xs text-muted">In each person&rsquo;s own time zone. Reminders and announcements never come then; announcements wait for their morning.</p>
        {hourSelect("quietStart", "From")}
        {hourSelect("quietEnd", "Until")}
        <div className="flex items-center justify-between gap-3 py-2 text-sm">
          <span>Followers, comments and likes then arrive silently (messages still ring)</span>
          <Switch checked={r.quietSocialSilent} label="Silent social notifications in quiet hours" onChange={(v) => set("quietSocialSilent", v)} />
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-line p-4">
        <legend className="px-1 text-sm font-semibold">Grouping</legend>
        <p className="text-xs text-muted">While a notification is unopened, more of the same quietly update it (&ldquo;Alex and 4 others&hellip;&rdquo;) instead of buzzing again. iPhone updates it in place; Android keeps the first.</p>
        {num("groupHours", "Likes, comments and followers collect for", "hours", 1, 168)}
        {num("messageRealertMinutes", "A busy chat buzzes again at most every", "min", 1, 240)}
      </fieldset>

      <fieldset className="rounded-2xl border border-line p-4">
        <legend className="px-1 text-sm font-semibold">Memory reminders</legend>
        <div className="flex items-center justify-between gap-3 py-2 text-sm">
          <span>Send memory reminders</span>
          <Switch checked={r.remindersOn} label="Send memory reminders" onChange={(v) => set("remindersOn", v)} />
        </div>
        {num("reminderEveryDays", "At most one every", "days", 1, 60)}
        {num("reminderInactiveDays", "Only if they haven't opened the app in", "days", 1, 60)}
        {num("reminderSkipSocial", "Skip if they had this many social notifications this week", "", 1, 100)}
        {hourSelect("reminderHour", "Sent from (their evening)")}
      </fieldset>

      <fieldset className="rounded-2xl border border-line p-4">
        <legend className="px-1 text-sm font-semibold">Daily limit</legend>
        {num("lowPerDay", "Reminders and announcements together, per person per day", "", 0, 5)}
        <p className="text-xs text-muted">Messages, followers, comments and likes are never held back by this.</p>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button type="button" className="btn-accent" disabled={!changed || state === "saving"} onClick={() => void save()}>
          {state === "saving" ? "Saving…" : "Save rules"}
        </button>
        <button type="button" className="text-sm text-muted hover:text-ink" onClick={() => setR(DEFAULT_RULES)}>
          Back to the defaults
        </button>
        {state === "saved" && !changed && <span className="text-sm text-accent">Saved. They apply from the next notification.</span>}
        {state === "error" && <span className="text-sm text-red-700">Couldn&rsquo;t save. Run migration 068 first?</span>}
      </div>
    </div>
  );
}

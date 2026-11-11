"use client";

import { useState } from "react";
import { Switch } from "../Switch";

export type TemplateRow = { kind: string; title: string; body: string; enabled: boolean };

// By priority, highest first; each with when it's sent. "_many" ones are
// the same notification once several have collected into it.
const GROUPS: { label: string; note: string; kinds: [string, string][] }[] = [
  {
    label: "P1 · Messages",
    note: "Straight away. A chat that keeps going updates one notification, buzzing again at most every few minutes.",
    kinds: [
      ["message", "A friend sends them a chat message"],
      ["message_many", "…several messages in the same chat"],
      ["postcard", "Someone who isn't a friend sends them a postcard"],
    ],
  },
  {
    label: "P2 · Followers",
    note: "Straight away; more while it's unopened join the same notification.",
    kinds: [
      ["follow", "Someone starts following them"],
      ["follow_many", "…more people follow before they've looked"],
      ["follow_request", "Someone asks to follow their private account"],
      ["follow_request_many", "…more requests before they've looked"],
      ["follow_accepted", "Their follow request is accepted"],
      ["invite_joined", "A friend joins through their invite link"],
    ],
  },
  {
    label: "P3 · Comments and replies",
    note: "The first buzzes; more on the same memory update it.",
    kinds: [
      ["comment", "Someone comments on their memory"],
      ["comment_many", "…more people comment before they've looked"],
      ["question", "Someone asks them about a place they've been"],
      ["answer", "Someone answers their question"],
      ["answer_many", "…more people answer before they've looked"],
    ],
  },
  {
    label: "P4 · Likes",
    note: "The first like buzzes; the rest quietly update it until they've opened it.",
    kinds: [
      ["like", "Someone likes their memory"],
      ["like_many", "…more likes before they've looked"],
    ],
  },
  {
    label: "P5 · Memory reminders",
    note: "About once a week, only for people who haven't been around and haven't had much social news. Opens One to remember in the feed.",
    kinds: [
      ["reminder_anniversary", "Something happened on this day in an earlier year"],
      ["reminder_photos", "A trip or event still has no photos"],
      ["reminder_memory", "Otherwise: the day's One to remember"],
    ],
  },
];

/** The automatic notifications: what they say, and whether they're sent at all. */
export function PushTemplates({ templates }: { templates: TemplateRow[] }) {
  const byKind = new Map(templates.map((t) => [t.kind, t]));
  return (
    <div>
      <p className="mb-4 text-xs text-muted">
        <code>{"{name}"}</code> who did it · <code>{"{others}"}</code> &ldquo;4 others&rdquo; · <code>{"{count}"}</code> how many · <code>{"{text}"}</code> their comment,
        question or message · <code>{"{place}"}</code> the country · reminders: <code>{"{title}"}</code> <code>{"{flag}"}</code> <code>{"{ago}"}</code> <code>{"{year}"}</code>.
        Each goes only to people with that kind switched on in their Settings.
      </p>
      <div className="space-y-6">
        {GROUPS.map((g) => {
          const rows = g.kinds.filter(([k]) => byKind.has(k));
          if (!rows.length) return null;
          return (
            <div key={g.label}>
              <p className="text-sm font-semibold">{g.label}</p>
              <p className="mb-2 text-xs text-muted">{g.note}</p>
              <ul className="space-y-3">
                {rows.map(([k, when]) => (
                  <TemplateCard key={k} t={byKind.get(k)!} when={when} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TemplateCard({ t, when }: { t: TemplateRow; when: string }) {
  const [title, setTitle] = useState(t.title);
  const [body, setBody] = useState(t.body);
  const [enabled, setEnabled] = useState(t.enabled);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saved, setSaved] = useState({ title: t.title, body: t.body });
  const changed = title !== saved.title || body !== saved.body;
  // The grouped wording follows its notification's switch.
  const grouped = t.kind.endsWith("_many");

  async function save(next: { title: string; body: string; enabled: boolean }) {
    setState("saving");
    const res = await fetch("/api/admin/push/templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: t.kind, ...next }) });
    setState(res.ok ? "saved" : "error");
    if (res.ok) setSaved({ title: next.title, body: next.body });
  }

  return (
    <li className={grouped ? "ml-4 rounded-2xl border border-dashed border-line p-4" : "rounded-2xl border border-line p-4"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{when}</p>
          {!grouped && <p className="text-xs text-muted">{enabled ? "Sent" : "Switched off: nobody gets this one"}</p>}
        </div>
        {!grouped && (
          <Switch
            checked={enabled}
            label={`Send "${when}" notifications`}
            onChange={(v) => {
              setEnabled(v);
              void save({ title, body, enabled: v });
            }}
          />
        )}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr]">
        <input className="field !py-2" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
        <input className="field !py-2" value={body} maxLength={300} onChange={(e) => setBody(e.target.value)} aria-label="Message" />
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs">
        {changed && (
          <button type="button" onClick={() => void save({ title, body, enabled })} className="btn-accent !py-1.5 text-xs" disabled={state === "saving"}>
            Save
          </button>
        )}
        {state === "saved" && !changed && <span className="text-accent">Saved</span>}
        {state === "error" && <span className="text-red-700">Couldn&rsquo;t save. Try again.</span>}
      </div>
    </li>
  );
}

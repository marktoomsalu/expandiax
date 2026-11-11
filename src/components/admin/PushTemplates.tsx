"use client";

import { useState } from "react";
import { Switch } from "../Switch";

export type TemplateRow = { kind: string; title: string; body: string; enabled: boolean };

const WHEN: Record<string, string> = {
  follow: "Someone starts following them",
  follow_request: "Someone asks to follow their private account",
  follow_accepted: "Their follow request is accepted",
  like: "Someone likes their trip or event",
  comment: "Someone comments on their post",
  question: "Someone asks them about a place they've been",
  answer: "Someone answers their question",
  message: "A friend sends them a chat message",
  postcard: "Someone who isn't a friend sends them a postcard",
};

/** The automatic notifications: what they say, and whether they're sent at all. */
export function PushTemplates({ templates }: { templates: TemplateRow[] }) {
  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        Use <code>{"{name}"}</code> for who did it, <code>{"{text}"}</code> for their comment, question or message, <code>{"{place}"}</code> for the
        country and <code>{"{thing}"}</code> for &ldquo;trip&rdquo; or &ldquo;event&rdquo;. Each still goes only to people with that kind switched on in their Settings.
      </p>
      <ul className="space-y-3">
        {templates.map((t) => (
          <TemplateCard key={t.kind} t={t} />
        ))}
      </ul>
    </div>
  );
}

function TemplateCard({ t }: { t: TemplateRow }) {
  const [title, setTitle] = useState(t.title);
  const [body, setBody] = useState(t.body);
  const [enabled, setEnabled] = useState(t.enabled);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saved, setSaved] = useState({ title: t.title, body: t.body });
  const changed = title !== saved.title || body !== saved.body;

  async function save(next: { title: string; body: string; enabled: boolean }) {
    setState("saving");
    const res = await fetch("/api/admin/push/templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: t.kind, ...next }) });
    setState(res.ok ? "saved" : "error");
    if (res.ok) setSaved({ title: next.title, body: next.body });
  }

  return (
    <li className="rounded-2xl border border-line p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{WHEN[t.kind] ?? t.kind}</p>
          <p className="text-xs text-muted">{enabled ? "Sent" : "Switched off: nobody gets this one"}</p>
        </div>
        <Switch
          checked={enabled}
          label={`Send "${WHEN[t.kind] ?? t.kind}" notifications`}
          onChange={(v) => {
            setEnabled(v);
            void save({ title, body, enabled: v });
          }}
        />
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

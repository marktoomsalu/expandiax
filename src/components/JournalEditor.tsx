"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Your journal for one trip: the longer story, written for yourself. It
 * saves as you type. Private by default; sharing it lets whoever can see
 * the trip read it too.
 */
export function JournalEditor({ visitId, userId, initial }: { visitId: string; userId: string; initial: { body: string; is_shared: boolean } | null }) {
  const [body, setBody] = useState(initial?.body ?? "");
  const [shared, setShared] = useState(initial?.is_shared ?? false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef({ body: initial?.body ?? "", shared: initial?.is_shared ?? false });

  async function save(next: { body: string; shared: boolean }) {
    if (next.body === last.current.body && next.shared === last.current.shared) return;
    setState("saving");
    const { error } = await createClient()
      .from("trip_journals")
      .upsert({ visit_id: visitId, user_id: userId, body: next.body, is_shared: next.shared, updated_at: new Date().toISOString() });
    if (error) {
      setState("error");
      return;
    }
    last.current = next;
    setState("saved");
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function onType(value: string) {
    setBody(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save({ body: value, shared }), 1200);
  }

  return (
    <div>
      <label htmlFor="trip-journal" className="sr-only">
        Journal
      </label>
      <textarea
        id="trip-journal"
        className="field min-h-[14rem] font-serif text-[17px] leading-relaxed"
        placeholder="Write it all down: what happened, who you met, how it felt. Nobody needs to read it."
        value={body}
        maxLength={20000}
        onChange={(e) => onType(e.target.value)}
        onBlur={() => {
          if (timer.current) clearTimeout(timer.current);
          void save({ body, shared });
        }}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5" role="group" aria-label="Who can read it">
          {[
            { on: false, label: "Only me", Icon: Lock },
            { on: true, label: "Share with the trip", Icon: Users },
          ].map(({ on, label, Icon }) => (
            <button
              key={label}
              type="button"
              aria-pressed={shared === on}
              onClick={() => {
                setShared(on);
                void save({ body, shared: on });
              }}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                shared === on ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"
              )}
            >
              <Icon size={11} aria-hidden /> {label}
            </button>
          ))}
        </div>
        <span role="status" className={cn("text-xs", state === "error" ? "text-red-800 dark:text-red-400" : state === "saved" ? "text-accent" : "text-muted")}>
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? "Couldn't save. Try again." : "Saved automatically as you write."}
        </span>
      </div>
      {shared && <p className="mt-1.5 text-xs text-muted">Anyone who can see this trip can read your journal.</p>}
    </div>
  );
}

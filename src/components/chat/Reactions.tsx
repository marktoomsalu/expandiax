"use client";

import { useId } from "react";
import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";

// ExpandiaX's own reactions: little globes with faces (and a heart with the
// globe's lines inside), in the brand's pinks, oranges and plums. Six, the
// feelings everyone uses: love, laughing, dreamy, wow, aww, yes.

export const REACTIONS = ["love", "haha", "dreamy", "wow", "sad", "yes"] as const;
export type Reaction = (typeof REACTIONS)[number];

export const REACTION_LABEL: Record<Reaction, string> = {
  love: "Love",
  haha: "Haha",
  dreamy: "Dreamy",
  wow: "Wow",
  sad: "Aww",
  yes: "Yes",
};

const COLORS: Record<Reaction, [string, string]> = {
  love: ["#ff5f9e", "#f2366f"],
  haha: ["#ffc93d", "#fb7822"],
  dreamy: ["#fa51a2", "#8b2a8f"],
  wow: ["#fb9a3c", "#fa51a2"],
  sad: ["#9b5bd6", "#3b1a6b"],
  yes: ["#fb7822", "#fa51a2"],
};

const HEART = "M16 28.5S3.5 21 3.5 12.3C3.5 7.7 7 4.5 10.9 4.5c2.3 0 4 1.1 5.1 2.7 1.1-1.6 2.8-2.7 5.1-2.7 3.9 0 7.4 3.2 7.4 7.8C28.5 21 16 28.5 16 28.5z";

/** One reaction, drawn. */
export function ReactionIcon({ kind, size = 28, className }: { kind: Reaction; size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const [a, b] = COLORS[kind];
  const white = { stroke: "#fff", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  // The globe's lines, faint, behind the face.
  const globe = (
    <g opacity={0.22} {...white} strokeWidth={1.2}>
      <ellipse cx="16" cy="16" rx="6" ry="13" />
      <path d="M3.5 16h25M5.5 9.5h21M5.5 22.5h21" />
    </g>
  );
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
        <clipPath id={`c${id}`}>{kind === "love" ? <path d={HEART} /> : <circle cx="16" cy="16" r="13" />}</clipPath>
      </defs>
      {kind === "love" ? <path d={HEART} fill={`url(#g${id})`} /> : <circle cx="16" cy="16" r="13" fill={`url(#g${id})`} />}
      <g clipPath={`url(#c${id})`}>{globe}</g>
      {/* A little shine, top left. */}
      <ellipse cx={kind === "love" ? 10 : 11} cy={kind === "love" ? 9.5 : 9} rx="3" ry="1.6" fill="#fff" opacity={0.35} transform={`rotate(-30 ${kind === "love" ? 10 : 11} 9)`} />

      {kind === "haha" && (
        <>
          <path d="M9.5 13.2l2.2-1.9 2.2 1.9M18.1 13.2l2.2-1.9 2.2 1.9" {...white} />
          <path d="M9.3 17.2h13.4a6.7 6.7 0 0 1-13.4 0z" fill="#fff" />
          <path d="M12.6 21.6a5 5 0 0 0 6.8 0" stroke={b} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        </>
      )}
      {kind === "dreamy" && (
        <>
          <path d="M11.2 15.4s-3-1.8-3-3.8c0-1.1.9-1.9 1.8-1.9.6 0 1 .3 1.2.7.3-.4.7-.7 1.2-.7 1 0 1.8.8 1.8 1.9 0 2-3 3.8-3 3.8zM20.8 15.4s-3-1.8-3-3.8c0-1.1.9-1.9 1.8-1.9.6 0 1 .3 1.2.7.3-.4.7-.7 1.2-.7 1 0 1.8.8 1.8 1.9 0 2-3 3.8-3 3.8z" fill="#fff" />
          <path d="M11.3 19.6c1.2 1.7 2.9 2.6 4.7 2.6s3.5-.9 4.7-2.6" {...white} />
        </>
      )}
      {kind === "wow" && (
        <>
          <path d="M9.6 10.2c1-.9 2.4-1.1 3.6-.6M22.4 10.2c-1-.9-2.4-1.1-3.6-.6" {...white} strokeWidth={1.6} />
          <circle cx="12" cy="14" r="1.9" fill="#fff" />
          <circle cx="20" cy="14" r="1.9" fill="#fff" />
          <ellipse cx="16" cy="21" rx="2.7" ry="3.4" fill="#fff" />
        </>
      )}
      {kind === "sad" && (
        <>
          <path d="M9.8 11.6c1.2.2 2.4-.2 3.2-1M22.2 11.6c-1.2.2-2.4-.2-3.2-1" {...white} strokeWidth={1.6} />
          <circle cx="12" cy="15" r="1.7" fill="#fff" />
          <circle cx="20" cy="15" r="1.7" fill="#fff" />
          <path d="M12 22.4c2.3-2.2 5.7-2.2 8 0" {...white} />
          <path d="M21.6 17.6c0 0-1.5 1.9-1.5 2.9a1.5 1.5 0 0 0 3 0c0-1-1.5-2.9-1.5-2.9z" fill="#9fe0ff" />
        </>
      )}
      {kind === "yes" && (
        <path
          d="M8.5 14.6h3.2v9.6H8.5zM13.2 14.6l3.5-5.6c.5-.8 1.5-1 2.2-.5.6.5.8 1.2.6 1.9l-.9 3.2h4.2c1.2 0 2.1 1.1 1.8 2.3l-1.5 6.2c-.2.9-1 1.4-1.8 1.4h-8.1z"
          fill="#fff"
        />
      )}
    </svg>
  );
}

/** The row of reactions that opens on a long press, plus Copy. */
export function ReactionPicker({ current, onPick, onCopy, align }: { current: Reaction | null; onPick: (r: Reaction) => void; onCopy: () => void; align: "left" | "right" }) {
  return (
    <div className={cn("flex flex-col gap-1.5", align === "right" ? "items-end" : "items-start")}>
      <div role="menu" aria-label="React" className="react-bar flex items-center gap-0.5 rounded-full bg-surface px-1.5 py-1 shadow-xl ring-1 ring-line">
        {REACTIONS.map((r, i) => (
          <button
            key={r}
            type="button"
            role="menuitemradio"
            aria-checked={current === r}
            aria-label={REACTION_LABEL[r]}
            onClick={() => onPick(r)}
            className={cn("react-pop flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-90", current === r && "bg-accent-soft")}
            style={{ animationDelay: `${i * 35}ms` }}
          >
            <ReactionIcon kind={r} size={30} />
          </button>
        ))}
      </div>
      <button type="button" onClick={onCopy} className="react-bar flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-medium shadow-lg ring-1 ring-line">
        <Copy size={13} aria-hidden /> Copy
      </button>
    </div>
  );
}

/** The reactions under a message: tap yours to take it back. */
export function ReactionChips({ list, me, onToggleMine }: { list: { user_id: string; reaction: Reaction }[]; me: string; onToggleMine: () => void }) {
  if (!list.length) return null;
  const kinds = [...new Set(list.map((r) => r.reaction))];
  const mine = list.some((r) => r.user_id === me);
  return (
    <button
      type="button"
      onClick={onToggleMine}
      disabled={!mine}
      aria-label={`${list.map((r) => REACTION_LABEL[r.reaction]).join(", ")}${mine ? ". Tap to remove yours" : ""}`}
      className={cn("react-land relative -mt-2 flex items-center gap-0.5 rounded-full bg-surface px-1 py-0.5 shadow-sm ring-1", mine ? "ring-accent/50" : "ring-line")}
    >
      {kinds.map((k) => (
        <ReactionIcon key={k} kind={k} size={18} />
      ))}
      {list.length > 1 && <span className="px-0.5 text-[11px] font-medium text-muted">{list.length}</span>}
    </button>
  );
}

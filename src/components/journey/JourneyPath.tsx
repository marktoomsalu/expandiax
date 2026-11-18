"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookOpenCheck, Camera, Check, ChevronDown, Globe2, Handshake, Lock, MessageCircle, Music2, Ticket, User, Users } from "lucide-react";
import type { Journey, JourneyStep } from "@/lib/journey";
import { openChat } from "@/lib/chat";
import { tapLight, tapSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { JourneyRing } from "./JourneyRing";

const ICONS = { user: User, globe: Globe2, camera: Camera, ticket: Ticket, music: Music2, users: Users, handshake: Handshake, chat: MessageCircle };
const SEEN_KEY = "expandiax:chapter-one-seen";

/** The parts already celebrated here; null the very first time. */
function readSeen(): string[] | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

/**
 * Chapter One as a trail: eight parts of their story, the next one open
 * with its button, the ones done since they last looked ticking off with a
 * little burst, and the badge waiting at the end.
 */
export function JourneyPath({ journey, name }: { journey: Journey; name: string | null }) {
  const reduce = useReducedMotion();
  const [fresh, setFresh] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(journey.next?.id ?? null);

  // What's been done since the last look gets its moment now.
  useEffect(() => {
    const seen = readSeen();
    const done = journey.steps.filter((s) => s.done).map((s) => s.id);
    // The first look: what was done before is just there, not "just done".
    const now = seen === null ? [] : done.filter((id) => !seen.includes(id));
    if (now.length) {
      setFresh(now);
      setTimeout(() => tapSuccess(), 700);
    }
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(done));
    } catch {}
  }, [journey]);

  return (
    <div className="mx-auto max-w-xl pb-16">
      {/* The opening page of the chapter */}
      <header className="relative overflow-hidden bg-[radial-gradient(120%_120%_at_15%_0%,#6e1e6a_0%,#2b0b2e_60%,#1a0620_100%)] px-6 pb-10 pt-10 text-white sm:mt-6 sm:rounded-[28px]">
        <span className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#fa51a2]/30 blur-3xl" aria-hidden />
        <span className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-[#fb7822]/20 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-5">
          <JourneyRing done={journey.done} total={journey.total} size={92} light />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ffb3d6]">Chapter One</p>
            <h1 className="mt-1 font-serif text-3xl leading-tight">
              {journey.finished ? "Your story has begun." : name ? `${name}, your story starts here.` : "Your story starts here."}
            </h1>
          </div>
        </div>
        <p className="relative mt-5 text-sm text-white/75">
          {journey.finished
            ? "All eight done. Your world is on the map, your memories have their songs, and your people are here."
            : "Eight things that make ExpandiaX yours. Do them in any order; each one ticks itself off, and the last one earns you a badge."}
        </p>
      </header>

      {/* The trail */}
      <ol className="relative mt-8 px-5">
        {/* The line the parts sit on, filled as far as they've come */}
        <span className="absolute bottom-24 left-[2.85rem] top-2 w-0.5 rounded-full bg-line" aria-hidden />
        <motion.span
          className="absolute left-[2.85rem] top-2 w-0.5 origin-top rounded-full bg-gradient-to-b from-[#fa51a2] to-[#fb7822]"
          style={{ bottom: "6rem" }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: journey.done / journey.total }}
          transition={{ duration: reduce ? 0 : 1.1, ease: "easeOut", delay: 0.2 }}
          aria-hidden
        />
        {journey.steps.map((step, i) => (
          <StepRow
            key={step.id}
            step={step}
            index={i}
            isNext={journey.next?.id === step.id}
            isFresh={fresh.includes(step.id)}
            expanded={open === step.id}
            onToggle={() => {
              tapLight();
              setOpen((o) => (o === step.id ? null : step.id));
            }}
          />
        ))}

        {/* The badge at the end of the trail */}
        <li className="relative mt-2 flex items-center gap-4">
          <motion.span
            className={cn(
              "relative z-10 flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-full text-white",
              journey.finished ? "bg-gradient-to-br from-[#fa51a2] via-[#f43f5e] to-[#fb7822] shadow-lg shadow-[#fa51a2]/40" : "bg-raised text-muted ring-1 ring-line"
            )}
            initial={reduce ? false : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 + journey.total * 0.06, type: "spring", stiffness: 260, damping: 16 }}
          >
            <BookOpenCheck size={28} aria-hidden />
            {!journey.finished && (
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-canvas ring-1 ring-line">
                <Lock size={12} aria-hidden />
              </span>
            )}
          </motion.span>
          <div>
            <p className="font-serif text-lg leading-tight">Chapter One badge</p>
            <p className="text-sm text-muted">
              {journey.finished ? "Earned. It's on your profile." : `${journey.total - journey.done} to go, and it's yours.`}
            </p>
          </div>
        </li>
      </ol>

      {journey.finished && (
        <div className="mt-8 px-5 text-center">
          <Link href="/stats#badges" className="btn-accent">
            See my badges
          </Link>
        </div>
      )}
    </div>
  );
}

function StepRow({
  step,
  index,
  isNext,
  isFresh,
  expanded,
  onToggle,
}: {
  step: JourneyStep;
  index: number;
  isNext: boolean;
  isFresh: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const reduce = useReducedMotion();
  const Icon = ICONS[step.icon];
  const delay = 0.15 + index * 0.06;

  return (
    <motion.li
      className="relative pb-5"
      initial={reduce ? false : { opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
    >
      <div className="flex items-start gap-4">
        {/* The marker on the trail */}
        <span className="relative z-10 mt-1 shrink-0">
          {isNext && !reduce && (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full border-2 border-[#fa51a2]"
              animate={{ scale: [1, 1.45], opacity: [0.7, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <motion.span
            className={cn(
              "relative flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full",
              step.done
                ? "bg-gradient-to-br from-[#fa51a2] to-[#fb7822] text-white shadow-md shadow-[#fa51a2]/30"
                : isNext
                  ? "bg-surface text-accent ring-2 ring-accent"
                  : "bg-surface text-muted ring-1 ring-line"
            )}
            initial={isFresh && !reduce ? { scale: 0.6 } : false}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 12, delay: delay + 0.35 }}
          >
            <Icon size={26} aria-hidden />
            {step.done && (
              <motion.span
                className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-canvas text-accent ring-2 ring-canvas"
                initial={isFresh && !reduce ? { scale: 0 } : false}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 14, delay: delay + 0.6 }}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#22a06b] text-white">
                  <Check size={13} strokeWidth={3} aria-hidden />
                </span>
              </motion.span>
            )}
            {isFresh && !reduce && <Burst delay={delay + 0.6} />}
          </motion.span>
        </span>

        {/* The part of the story */}
        <div className={cn("min-w-0 flex-1 rounded-2xl border bg-surface transition-colors", isNext ? "border-accent/50 shadow-sm" : "border-line", step.done && "bg-surface/60")}>
          <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex w-full items-center gap-3 px-4 py-3 text-left">
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">
                Part {index + 1}
                {isNext && <span className="ml-2 text-accent">Next</span>}
                {isFresh && <span className="ml-2 text-[#22a06b]">Just done</span>}
              </span>
              <span className={cn("block font-serif text-lg leading-tight", step.done && "text-muted")}>{step.title}</span>
              {step.done ? (
                <span className="mt-0.5 block text-sm text-muted">{step.doneLine}</span>
              ) : (
                step.progress && <span className="mt-0.5 block text-xs font-medium text-accent">{step.progress}</span>
              )}
            </span>
            {!step.done && <ChevronDown size={18} className={cn("shrink-0 text-muted transition-transform", expanded && "rotate-180")} aria-hidden />}
          </button>
          <AnimatePresence initial={false}>
            {expanded && !step.done && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4">
                  <p className="text-sm text-muted">{step.story}</p>
                  {"openChat" in step.action ? (
                    <button
                      type="button"
                      onClick={() => {
                        tapLight();
                        openChat();
                      }}
                      className="btn-accent mt-3 !py-2 text-sm"
                    >
                      {step.action.label}
                    </button>
                  ) : (
                    <Link href={step.action.href} onClick={() => tapLight()} className="btn-accent mt-3 !py-2 text-sm">
                      {step.action.label}
                    </Link>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.li>
  );
}

const BURST = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return { x: Math.cos(a) * 46, y: Math.sin(a) * 46, c: ["#fa51a2", "#fb7822", "#ffd166", "#c084fc"][i % 4] };
});

/** A small burst of confetti around a part that's just been done. */
function Burst({ delay }: { delay: number }) {
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      {BURST.map((p, i) => (
        <motion.span
          key={i}
          className="absolute h-2 w-2 rounded-full"
          style={{ background: p.c }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
          animate={{ x: p.x, y: p.y, opacity: [0, 1, 0], scale: [0.4, 1, 0.6] }}
          transition={{ duration: 0.9, delay, ease: "easeOut" }}
        />
      ))}
    </span>
  );
}

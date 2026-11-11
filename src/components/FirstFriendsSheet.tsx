"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Search, Share2, X } from "lucide-react";
import { PeopleSuggest } from "./PeopleSuggest";
import { FollowButton } from "@/components/FollowButton";
import { tapSuccess } from "@/lib/haptics";
import type { PersonCard } from "@/lib/experienceNetworkData";
import { inviteText, inviteUrl } from "@/lib/invite";

// "Later" waits a few days before offering again; finishing waits much longer.
const SNOOZE_KEY = "expandiax:first-friends-until";
const LATER_DAYS = 3;
const DONE_DAYS = 30;
const CREW = 5;

function snoozedUntil(): number {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function snooze(days: number) {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * 86_400_000));
  } catch {}
}

/**
 * "Who's coming with you?": a new member's first friends, in one sheet.
 * Suggestions with why they match, a crew row of five passport stamps that
 * fill as you follow, an "ON BOARD" stamp on each person you add, search,
 * and the phone's own share sheet to invite friends. Opens by itself while
 * someone follows fewer than three people (and hasn't said "Later" lately),
 * or whenever `forceOpen` asks.
 */
export function FirstFriendsSheet({
  suggestions,
  followingCount,
  forceOpen,
  me,
}: {
  suggestions: PersonCard[];
  followingCount: number;
  forceOpen: boolean;
  me: { username: string; display_name: string };
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  // Kept from the first render: following someone mustn't make them vanish from the list.
  const [people] = useState(suggestions);
  const [aboard, setAboard] = useState<Set<string>>(new Set());
  const [shared, setShared] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (forceOpen || (followingCount < 3 && people.length > 0 && snoozedUntil() < Date.now())) setOpen(true);
  }, [forceOpen, followingCount, people.length]);

  useEffect(() => {
    if (!open) return;
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(LATER_DAYS);
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close(days: number) {
    snooze(days);
    setOpen(false);
    if (aboard.size) router.refresh();
    if (forceOpen) router.replace(window.location.pathname);
  }

  function changed(id: string, state: "following" | "requested" | "none") {
    setAboard((cur) => {
      const next = new Set(cur);
      if (state === "none") next.delete(id);
      else {
        next.add(id);
        tapSuccess();
      }
      return next;
    });
  }

  async function invite() {
    // Your invite link: friends who join through it follow you straight away.
    const url = inviteUrl(me.username);
    const text = inviteText(me.display_name.split(" ")[0]);
    try {
      if (navigator.share) {
        await navigator.share({ title: "ExpandiaX", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShared("Link copied - paste it to your friends");
    } catch {
      // Closing the share sheet without sharing lands here too.
    }
  }

  const crew = Math.min(CREW, followingCount + aboard.size);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && close(LATER_DAYS)}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="ff-h"
            className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-canvas shadow-2xl sm:rounded-[28px]"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          >
            {/* Boarding now */}
            <div className="relative shrink-0 bg-[#140d18] px-5 pb-5 pt-3 text-[#fdf3e3]">
              <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/25 sm:hidden" aria-hidden />
              <button type="button" onClick={() => close(LATER_DAYS)} aria-label="Close" className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
                <X size={18} />
              </button>
              <p className="font-mono text-[10px] font-semibold tracking-[0.3em] text-accent">BOARDING NOW</p>
              <h2 id="ff-h" className="mt-1.5 font-serif text-3xl leading-tight">
                Who&rsquo;s coming <span className="italic">with you?</span>
              </h2>
              <p className="mt-1 text-sm text-white/65">Follow a few people - their places, trips and events fill your Explore.</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex gap-1.5" aria-hidden>
                  {Array.from({ length: CREW }, (_, i) => (
                    <motion.span
                      key={i}
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${i < crew ? "gradient-travel text-white" : "border-2 border-dashed border-white/25"}`}
                      animate={i < crew && !reduce ? { rotate: [0, -14, 0], scale: [1, 1.25, 1] } : undefined}
                      transition={{ duration: 0.45 }}
                    >
                      {i < crew && <Check size={15} strokeWidth={3} />}
                    </motion.span>
                  ))}
                </div>
                <p className="font-mono text-[11px] tracking-[0.2em] text-white/70">
                  CREW {crew}/{CREW}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <form
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (query.trim()) {
                    close(LATER_DAYS);
                    router.push(`/explore?q=${encodeURIComponent(query.trim())}`);
                  }
                }}
                className="relative"
              >
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Know someone here? Search by name"
                  aria-label="Search people"
                  autoComplete="off"
                  className="field !rounded-full !py-2.5 !pl-11"
                />
                {/* Matches show as you type. */}
                {query.trim().length >= 2 && (
                  <div className="mt-2">
                    <PeopleSuggest query={query} onPick={() => close(LATER_DAYS)} />
                  </div>
                )}
              </form>

              <p className="mb-2 mt-5 font-mono text-[10px] font-semibold tracking-[0.25em] text-muted">SUGGESTED FOR YOU</p>
              <ul className="space-y-3">
                {people.map((p, i) => {
                  const on = aboard.has(p.id);
                  const why = [p.headline, ...p.reasons]
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((r) => r!.text)
                    .join(" · ");
                  return (
                    <motion.li
                      key={p.id}
                      initial={reduce ? false : { opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.05 }}
                      className={`relative overflow-hidden rounded-2xl border bg-surface p-3 transition-colors ${on ? "border-accent/60" : "border-line"}`}
                    >
                      <div className="flex items-center gap-3">
                        <Link href={`/u/${p.username}`} className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-serif text-xl text-accent">
                          {p.avatar_url ? <Image src={p.avatar_url} alt="" fill sizes="56px" className="object-cover" /> : p.display_name.charAt(0)}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link href={`/u/${p.username}`} className="block truncate font-serif text-lg leading-tight hover:text-accent">
                            {p.display_name}
                          </Link>
                          {why && <p className="line-clamp-2 text-xs leading-snug text-muted">{why}</p>}
                        </div>
                        <FollowButton targetId={p.id} visibility={p.visibility} initialFollowing={false} onChange={(s) => changed(p.id, s)} />
                      </div>
                      {p.photos.length > 0 && (
                        <div className="mt-2.5 flex gap-1.5 pl-[4.25rem]">
                          {p.photos.map((url) => (
                            <span key={url} className="relative h-10 w-14 overflow-hidden rounded-md bg-raised">
                              <Image src={url} alt="" fill sizes="56px" className="object-cover" />
                            </span>
                          ))}
                        </div>
                      )}
                      <AnimatePresence>
                        {on && (
                          <motion.span
                            aria-hidden
                            className="pointer-events-none absolute right-24 top-1.5 rounded-md border-2 border-accent px-2 py-0.5 font-mono text-[11px] font-bold tracking-[0.2em] text-accent"
                            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 2.4, rotate: -24 }}
                            animate={{ opacity: 0.9, scale: 1, rotate: -12 }}
                            exit={{ opacity: 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          >
                            ON BOARD
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.li>
                  );
                })}
              </ul>
            </div>

            <div className="shrink-0 border-t border-line bg-canvas px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
              {shared && <p className="mb-2 text-center text-xs text-muted">{shared}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => void invite()} className="btn-accent flex-1 !py-3">
                  <Share2 size={16} aria-hidden /> Invite friends
                </button>
                <button type="button" onClick={() => close(crew >= 3 ? DONE_DAYS : LATER_DAYS)} className="btn-ghost !px-5 !py-3">
                  {crew >= 3 ? "Done" : "Later"}
                </button>
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

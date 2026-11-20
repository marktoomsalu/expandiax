"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Copy, Download, Link2, Loader2, Share2, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { inviteUrl } from "@/lib/invite";
import { isNativePlatform } from "@/lib/capacitor";
import { tapLight, tapSuccess } from "@/lib/haptics";
import { noteFeature } from "@/lib/usageClient";
import { cn } from "@/lib/utils";

export type StoryStyle = { key: string; label: string; sticker: boolean };

/** Instagram's own mark, so the button is recognised at a glance. */
function InstagramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const isIOS = () => typeof navigator !== "undefined" && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const canCopyImage = () => typeof window !== "undefined" && typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;

/**
 * Turn a trip, or your whole world, into something worth posting: pick a
 * style, see it on a Story, then one tap copies it and opens Instagram's
 * Story camera, where it pastes as a sticker over any photo. Your invite
 * link is ready for a Link sticker, so friends who tap it start their own
 * map (and follow you straight away).
 */
export function StoryShare({
  kind,
  id,
  styles,
  title,
  subtitle,
  trigger,
  triggerClassName,
}: {
  kind: "trip" | "world";
  id: string;
  styles: StoryStyle[];
  /** "Share Switzerland", "Share your world" */
  title: string;
  subtitle: string;
  /** What the button says. */
  trigger: React.ReactNode;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          tapLight();
          setOpen(true);
        }}
        className={triggerClassName}
      >
        {trigger}
      </button>
      <AnimatePresence>{open && <Sheet kind={kind} id={id} styles={styles} title={title} subtitle={subtitle} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function Sheet({ kind, id, styles, title, subtitle, onClose }: { kind: "trip" | "world"; id: string; styles: StoryStyle[]; title: string; subtitle: string; onClose: () => void }) {
  const reduce = useReducedMotion();
  const [style, setStyle] = useState(styles[0]);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState<"pick" | "copied">("pick");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const src = `/api/story/${kind}/${id}?style=${style.key}`;
  const ios = isIOS();
  const copyFlow = ios && canCopyImage();

  // Their username, for the Link sticker (their invite link).
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("username").eq("id", data.user.id).maybeSingle();
      setUsername((p?.username as string | undefined) ?? null);
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const image = () =>
    fetch(src).then((r) => {
      if (!r.ok) throw new Error("image");
      return r.blob();
    });

  /** The heart of it: copy the picture, then straight to Instagram's Story camera. */
  async function copyAndOpen() {
    setBusy(true);
    setError(null);
    try {
      // The ClipboardItem must be made inside the tap (Safari's rule), with the picture still on its way.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": image() })]);
      tapSuccess();
      noteFeature("story_copied");
      setStep("copied");
      setTimeout(() => {
        window.location.href = "instagram://story-camera";
      }, 650);
    } catch {
      setError("Couldn't copy it. Try “Save image” instead.");
    }
    setBusy(false);
  }

  async function shareFile() {
    setBusy(true);
    setError(null);
    try {
      const file = new File([await image()], "expandiax-story.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        noteFeature("story_shared");
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = "expandiax-story.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        noteFeature("story_saved");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Couldn't prepare the picture. Try again.");
    }
    setBusy(false);
  }

  async function copyLink() {
    if (!username) return;
    await navigator.clipboard?.writeText(inviteUrl(username)).catch(() => {});
    tapSuccess();
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  }

  return (
    <motion.div
      className="fixed inset-0 z-[88] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-h"
        className="flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-canvas shadow-2xl sm:rounded-[28px]"
        initial={reduce ? { opacity: 0 } : { y: "100%" }}
        animate={reduce ? { opacity: 1 } : { y: 0 }}
        exit={reduce ? { opacity: 0 } : { y: "100%" }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
          <div>
            <h2 id="story-h" className="font-serif text-2xl leading-tight">
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 rounded-full p-2 text-muted hover:bg-raised hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {styles.length > 1 && step === "pick" && (
            <div className="mb-3 flex gap-2" role="group" aria-label="Style">
              {styles.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={s.key === style.key}
                  onClick={() => {
                    tapLight();
                    setStyle(s);
                  }}
                  className={cn("rounded-full border px-3.5 py-1.5 text-sm", s.key === style.key ? "border-accent bg-accent text-white" : "border-line bg-surface hover:border-accent")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* How it will look on a Story: a sticker over a photo, or the whole Story. */}
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[17rem] overflow-hidden rounded-[22px] bg-[#1d0820] shadow-lg ring-1 ring-line">
            {style.sticker && (
              <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 30% 20%, #8fb7d9 0%, #5b7fa6 35%, #2f3d5c 70%, #1b2238 100%)" }}>
                <span className="absolute inset-x-0 top-3 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-white/60">Your photo</span>
              </div>
            )}
            {!loaded[src] && (
              <span className="absolute inset-0 flex items-center justify-center text-white/70">
                <Loader2 size={22} className="animate-spin" />
              </span>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.img
                  key={src}
                  src={src}
                  alt={style.sticker ? "Your sticker, as it will sit on a Story" : "Your Story"}
                  onLoad={() => setLoaded((l) => ({ ...l, [src]: true }))}
                  initial={reduce ? false : { opacity: 0, scale: 0.92, rotate: -2 }}
                  animate={{ opacity: loaded[src] ? 1 : 0, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 240, damping: 20 }}
                  className={style.sticker ? "w-[84%]" : "h-full w-full object-cover"}
                />
              </AnimatePresence>
            </div>
          </div>

          {step === "pick" ? (
            <div className="mt-4 space-y-2">
              {copyFlow ? (
                <button type="button" onClick={() => void copyAndOpen()} disabled={busy || !loaded[src]} className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(90deg, #fa51a2, #f43f5e 50%, #fb7822)" }}>
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <InstagramIcon />} Copy &amp; open Instagram
                </button>
              ) : (
                <button type="button" onClick={() => void shareFile()} disabled={busy || !loaded[src]} className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(90deg, #fa51a2, #f43f5e 50%, #fb7822)" }}>
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />} Share to your Story
                </button>
              )}
              <div className="flex justify-center gap-5 pt-1 text-sm">
                {copyFlow && (
                  <button type="button" onClick={() => void shareFile()} disabled={busy} className="inline-flex items-center gap-1.5 text-muted hover:text-ink">
                    <Download size={15} /> Save or send
                  </button>
                )}
                {username && (
                  <button type="button" onClick={() => void copyLink()} className="inline-flex items-center gap-1.5 text-muted hover:text-ink">
                    {linkCopied ? <Check size={15} /> : <Link2 size={15} />} {linkCopied ? "Link copied" : "Copy my link"}
                  </button>
                )}
              </div>
              {!copyFlow && !ios && isNativePlatform() && (
                <p className="text-center text-xs text-muted">In Instagram, add it from your photos as a Story or a sticker.</p>
              )}
            </div>
          ) : (
            // After copying: Instagram is opening; here's what to do there.
            <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl border border-accent/40 bg-accent-soft/50 p-4">
              <p className="flex items-center gap-2 font-semibold">
                <Sparkles size={16} className="text-accent" /> Copied. Instagram is opening…
              </p>
              <ol className="mt-3 space-y-2 text-sm">
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">1</span>
                  Take or pick a photo for your Story.
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">2</span>
                  Tap <strong className="font-semibold">“Add sticker”</strong> when it pops up, or press and hold and tap <strong className="font-semibold">Paste</strong>.
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">3</span>
                  <span>
                    Want friends to start their own? Come back, copy your link, and add it as a <strong className="font-semibold">Link sticker</strong>.
                  </span>
                </li>
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href="instagram://story-camera" className="btn-accent !py-2 text-sm">
                  <InstagramIcon size={16} /> Open Instagram
                </a>
                {username && (
                  <button type="button" onClick={() => void copyLink()} className="btn-ghost !py-2 text-sm">
                    {linkCopied ? <Check size={15} /> : <Copy size={15} />} {linkCopied ? "Link copied" : "Copy my link"}
                  </button>
                )}
                <button type="button" onClick={() => setStep("pick")} className="px-2 text-sm text-muted hover:text-ink">
                  Another style
                </button>
              </div>
            </motion.div>
          )}
          {error && (
            <p role="alert" className="mt-3 text-center text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}

"use client";

import { ChevronLeft, ChevronRight, Check, Image as ImageIcon, Settings, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { openAppSettings } from "@/lib/photoScan";
import { tapLight } from "@/lib/haptics";

// Turning on Full Access to photos, shown rather than told: ExpandiaX's own
// page in iPhone Settings (the Open Settings button lands right there), with
// the two taps marked: Photos, then Full Access. Coming back with it on, the
// search carries on by itself (WorldScanFlow listens for it).

function Step({ n }: { n: number }) {
  return <span className="gradient-travel flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-[0_0_0_3px_rgba(250,81,162,0.25)]">{n}</span>;
}

/** A small likeness of the two Settings screens, side by side. */
function SettingsLikeness({ now }: { now: "None" | "Limited Access" }) {
  const panel = "flex-1 overflow-hidden rounded-xl bg-[#1c1c1e] text-left text-[11px] text-white ring-1 ring-white/10";
  const row = "flex items-center gap-2 px-2.5 py-2";
  return (
    <div className="flex items-stretch gap-2" aria-hidden>
      <div className={panel}>
        <p className="flex items-center gap-0.5 px-2 pt-2 text-[10px] text-[#0a84ff]">
          <ChevronLeft size={11} /> Settings
        </p>
        <p className="px-2.5 pb-1.5 pt-1 text-[13px] font-semibold">ExpandiaX</p>
        <div className="mx-1.5 mb-1.5 rounded-lg bg-[#2c2c2e]">
          <div className={`${row} relative rounded-lg ring-2 ring-[#fa51a2]`}>
            <span className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-gradient-to-br from-[#ffd84d] via-[#ff6b8b] to-[#4fb3ff]">
              <ImageIcon size={9} className="text-white" />
            </span>
            <span className="flex-1">Photos</span>
            <span className="text-white/45">{now === "None" ? "None" : "Limited"}</span>
            <ChevronRight size={11} className="text-white/35" />
            <span className="absolute -right-1.5 -top-1.5">
              <Step n={1} />
            </span>
          </div>
        </div>
      </div>
      <div className={panel}>
        <p className="flex items-center gap-0.5 px-2 pt-2 text-[10px] text-[#0a84ff]">
          <ChevronLeft size={11} /> ExpandiaX
        </p>
        <p className="px-2.5 pb-1.5 pt-1 text-[13px] font-semibold">Photos</p>
        <div className="mx-1.5 mb-1.5 divide-y divide-white/10 rounded-lg bg-[#2c2c2e]">
          <div className={row}>
            <span className="flex-1 text-white/60">None</span>
          </div>
          <div className={row}>
            <span className="flex-1 text-white/60">Limited Access</span>
          </div>
          <div className={`${row} relative rounded-lg ring-2 ring-[#fa51a2]`}>
            <span className="flex-1 font-medium">Full Access</span>
            <Check size={12} className="text-[#0a84ff]" />
            <span className="absolute -right-1.5 -top-1.5">
              <Step n={2} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The guide: the likeness, the steps in words, and the way there. */
export function PhotoSettingsGuide({ now, onOpen }: { now: "None" | "Limited Access"; onOpen?: () => void }) {
  return (
    <div className="w-full rounded-[22px] bg-white/[0.07] p-3.5 text-left ring-1 ring-white/10">
      <SettingsLikeness now={now} />
      <ol className="mt-3 space-y-1.5 text-[13px] leading-snug text-white/80">
        <li className="flex items-center gap-2">
          <Step n={1} /> In Settings, tap <span className="font-semibold text-white">Photos</span>
        </li>
        <li className="flex items-center gap-2">
          <Step n={2} /> Choose <span className="font-semibold text-white">Full Access</span>
        </li>
      </ol>
      <button
        type="button"
        onClick={() => {
          tapLight();
          onOpen?.();
          void openAppSettings().catch(() => {});
        }}
        className="btn-accent mt-3.5 flex w-full items-center justify-center gap-2 py-3.5 text-base"
      >
        <Settings size={17} aria-hidden /> Open Settings
      </button>
      <p className="mt-2 text-center text-xs text-white/50">Then come back: we&apos;ll carry on by ourselves.</p>
    </div>
  );
}

/** The guide as a sheet from the bottom (for Limit Access, from the screens that mention it). */
export function PhotoSettingsSheet({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen?: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Allow full access to photos"
            className="w-full max-w-md rounded-t-[28px] bg-[#2b0b2e] px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 text-white"
            initial={{ y: 40 }}
            animate={{ y: 0 }}
            exit={{ y: 40 }}
            transition={{ type: "spring", damping: 26, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl leading-tight">Let it see all your trips</h2>
                <p className="mt-1 text-sm text-white/65">With Full Access, every photo with a place saved is looked at, not just the ones you chose.</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80">
                <X size={16} />
              </button>
            </div>
            <div className="mt-4">
              <PhotoSettingsGuide now="Limited Access" onOpen={onOpen} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

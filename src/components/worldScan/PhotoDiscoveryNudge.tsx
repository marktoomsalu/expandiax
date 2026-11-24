"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { canScanPhotos, photoAccess } from "@/lib/photoScan";
import { fromPhotosSeen } from "@/lib/memoryFinder";
import { tapLight } from "@/lib/haptics";

const KEY = "expandiax:photo-nudge-off";
const QUIET_DAYS = 30;

/**
 * On My World, for members who started without their photos (said no to
 * iPhone, or chose to add it themselves): a quiet way back to finding their
 * world in them, any time. Only in the iPhone app that can (build 12 on),
 * never once they've given access or looked in their photos, and gone for a
 * month when closed. `preview`: always shown (design previews only).
 */
export function PhotoDiscoveryNudge({ preview = false }: { preview?: boolean }) {
  const [show, setShow] = useState(preview);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (preview || !canScanPhotos() || fromPhotosSeen()) return;
    try {
      const off = Number(localStorage.getItem(KEY) ?? 0);
      if (off && Date.now() - off < QUIET_DAYS * 86_400_000) return;
    } catch {}
    void photoAccess()
      .then((s) => {
        if (s === "full" || s === "limited" || s === "restricted") return;
        setDenied(s === "denied");
        setShow(true);
      })
      .catch(() => {});
  }, [preview]);

  if (!show) return null;
  return (
    <div className="relative mt-6 overflow-hidden rounded-2xl p-4 pr-11 text-white" style={{ background: "radial-gradient(120% 120% at 0% 0%, #4a1450 0%, #2b0b2e 60%, #160520 100%)" }}>
      <button
        type="button"
        aria-label="Not now"
        onClick={() => {
          tapLight();
          try {
            localStorage.setItem(KEY, String(Date.now()));
          } catch {}
          setShow(false);
        }}
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:text-white"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3.5">
        <span className="gradient-travel flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-md shadow-accent/30">
          <Sparkles size={20} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-serif text-lg leading-tight">Your photos can fill in your map</p>
          <p className="mt-1 text-sm text-white/70">
            Countries, trips and concerts you haven&apos;t added yet, found in seconds. Read on your phone, and you choose what&apos;s kept.
          </p>
          <Link href="/my-world/find-trips" onClick={() => tapLight()} className="mt-3 inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#2b0b2e]">
            {denied ? "Turn on photos" : "Look in my photos"}
          </Link>
        </div>
      </div>
    </div>
  );
}

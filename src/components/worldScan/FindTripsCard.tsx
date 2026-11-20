"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { canScanPhotos } from "@/lib/photoScan";
import { worldScanned } from "@/lib/worldScan";

/** On My World, in the iPhone app with the scanner, until it's been done once. */
export function FindTripsCard() {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(canScanPhotos() && !worldScanned()), []);
  if (!show) return null;
  return (
    <Link
      href="/my-world/find-trips"
      className="mt-6 flex items-center gap-4 overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_15%_20%,#7a2276_0%,#2b0b2e_70%)] px-5 py-4 text-white shadow-lg shadow-black/10"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#fa51a2] to-[#fb7822]">
        <Sparkles size={20} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-serif text-lg leading-tight">Find trips in your photos</span>
        <span className="mt-0.5 block text-sm text-white/70">Your phone remembers more than you do.</span>
      </span>
      <span className="shrink-0 text-sm font-medium text-[#ffb3d6]">Try it &rarr;</span>
    </Link>
  );
}

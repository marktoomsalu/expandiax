"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import type { QrArt } from "@/lib/qrArt";
import { tapLight } from "@/lib/haptics";
import { noteFeature } from "@/lib/usageClient";

/** The code itself: dark dots on white, soft eyes, their photo (or the logo) in the middle. */
function Code({ art, photo, size }: { art: QrArt; photo: string | null; size: number }) {
  const id = useId().replace(/:/g, "");
  const { hole } = art;
  const pad = hole.size * 0.08;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${art.size} ${art.size}`} role="img" aria-label="Your invite QR code" className="block">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d28d9" />
          <stop offset="1" stopColor="#c0266f" />
        </linearGradient>
        <clipPath id={`c${id}`}>
          <circle cx={hole.at + hole.size / 2} cy={hole.at + hole.size / 2} r={hole.size / 2 - pad} />
        </clipPath>
      </defs>
      <rect width={art.size} height={art.size} rx={2.2} fill="#fff" />
      <path d={art.dots} fill="#2b0b2e" />
      {art.eyes.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x + 0.5} y={y + 0.5} width={6} height={6} rx={1.9} fill="none" stroke="#2b0b2e" strokeWidth={1} />
          <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.9} fill={`url(#g${id})`} />
        </g>
      ))}
      {photo ? (
        <>
          <circle cx={hole.at + hole.size / 2} cy={hole.at + hole.size / 2} r={hole.size / 2} fill={`url(#g${id})`} />
          <image href={photo} x={hole.at + pad} y={hole.at + pad} width={hole.size - 2 * pad} height={hole.size - 2 * pad} clipPath={`url(#c${id})`} preserveAspectRatio="xMidYMid slice" />
        </>
      ) : (
        <image href="/logo-mark.svg" x={hole.at + pad} y={hole.at + pad} width={hole.size - 2 * pad} height={hole.size - 2 * pad} />
      )}
    </svg>
  );
}

/**
 * "Met someone new?": a QR code of your invite link, for inviting people in
 * person. Their phone's camera opens it: straight to the App Store or Google
 * Play, and the invite is remembered through the install (lib/inviteClicks),
 * so you follow each other once they've joined. Full screen for scanning
 * across a table.
 */
export function InviteQR({ art, photo, firstName, username }: { art: QrArt; photo: string | null; firstName: string; username: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  const show = () => {
    tapLight();
    noteFeature("invite_qr");
    setOpen(true);
  };

  return (
    <>
      <section aria-labelledby="qr-h" className="mt-6 flex items-center gap-4 rounded-[24px] border border-line bg-surface p-4">
        <button type="button" onClick={show} className="shrink-0 rounded-2xl p-1 ring-1 ring-line transition active:scale-[0.97]" aria-label="Show your QR code full screen">
          <Code art={art} photo={photo} size={112} />
        </button>
        <div className="min-w-0">
          <h2 id="qr-h" className="font-serif text-lg leading-tight">Met someone new?</h2>
          <p className="mt-1 text-sm text-muted">Let them scan this with their phone&rsquo;s camera. Once they join, you follow each other.</p>
          <button type="button" onClick={show} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
            <Maximize2 size={14} aria-hidden /> Show full screen
          </button>
        </div>
      </section>

      {mounted &&
        open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Your invite QR code"
            className="fixed inset-0 z-[90] flex flex-col items-center justify-center px-6 text-center text-white"
            style={{ background: "radial-gradient(120% 80% at 50% 0%, #4a1450 0%, #2b0b2e 55%, #12041a 100%)", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={() => setOpen(false)}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80"
              style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
            >
              <X size={18} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wordmark.svg" alt="ExpandiaX" className="h-7 w-auto" />
            <p className="mt-8 font-serif text-3xl leading-tight">
              Join {firstName}
              <br />
              <span className="italic text-[#fa8fc4]">on ExpandiaX</span>
            </p>
            <div className="mt-7 rounded-[28px] bg-white p-3 shadow-[0_30px_80px_-20px_rgba(250,81,162,0.55)]" onClick={(e) => e.stopPropagation()}>
              <Code art={art} photo={photo} size={Math.min(300, typeof window !== "undefined" ? window.innerWidth - 96 : 300)} />
            </div>
            <p className="mt-5 text-sm text-white/70">Scan with your phone&rsquo;s camera</p>
            <p className="mt-1 text-xs text-white/45">expandiax.com/join/{username}</p>
          </div>,
          document.body
        )}
    </>
  );
}

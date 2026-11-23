"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Share2, X } from "lucide-react";
import type { QrArt } from "@/lib/qrArt";
import { INVITE_TEXT, inviteUrl } from "@/lib/invite";
import { tapLight, tapSuccess } from "@/lib/haptics";
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

/** One of the two ways to invite: a picture on top, what it does underneath. Both look alike, so neither is the "other" way. */
function Option({ onClick, label, hint, art, ariaLabel }: { onClick: () => void; label: string; hint: string; art: React.ReactNode; ariaLabel?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex flex-col items-center rounded-[22px] bg-white/[0.07] px-3 pb-3.5 pt-3.5 ring-1 ring-white/15 transition hover:bg-white/[0.11] active:scale-[0.97]"
    >
      <span className="flex h-16 w-16 items-center justify-center">{art}</span>
      <span className="mt-2.5 text-[15px] font-semibold leading-tight">{label}</span>
      <span className="mt-0.5 text-xs leading-snug text-white/60">{hint}</span>
    </button>
  );
}

/**
 * How to invite, side by side at the top of the invite card: send your link
 * (the phone's share sheet) or show your QR code to someone in front of you.
 * The code is the same link: their camera opens it, straight to the App Store
 * or Google Play, and the invite is remembered through the install
 * (lib/inviteClicks), so you follow each other once they've joined. Below
 * both, the link itself, to copy.
 */
export function InviteActions({ art, photo, firstName, username }: { art: QrArt; photo: string | null; firstName: string; username: string }) {
  const url = inviteUrl(username);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  async function copy() {
    noteFeature("invite_shared");
    await navigator.clipboard?.writeText(url).catch(() => {});
    tapSuccess();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  async function share() {
    tapLight();
    noteFeature("invite_shared");
    try {
      if (navigator.share) {
        await navigator.share({ title: "ExpandiaX", text: INVITE_TEXT, url });
        return;
      }
    } catch {
      return; // Closed the share sheet.
    }
    await copy();
  }
  function show() {
    tapLight();
    noteFeature("invite_qr");
    setOpen(true);
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-3">
        <Option
          onClick={() => void share()}
          label="Share link"
          hint="Send anywhere"
          art={
            <span className="gradient-travel flex h-16 w-16 items-center justify-center rounded-[18px] shadow-[0_12px_30px_-12px_rgba(250,81,162,0.8)]">
              <Share2 size={26} aria-hidden />
            </span>
          }
        />
        <Option
          onClick={show}
          label="Show QR code"
          hint="Scan in person"
          ariaLabel="Show QR code, to scan in person"
          art={
            <span className="rounded-[14px] bg-white p-1 shadow-[0_12px_30px_-12px_rgba(250,81,162,0.8)]">
              <Code art={art} photo={photo} size={56} />
            </span>
          }
        />
      </div>
      <button type="button" onClick={() => void copy()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full py-2 text-sm text-white/70 hover:text-white">
        {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
        <span className="truncate">{copied ? "Copied" : url.replace("https://", "")}</span>
      </button>

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
    </div>
  );
}

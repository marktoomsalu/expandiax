"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2, RotateCw, UploadCloud, X } from "lucide-react";
import {
  dismissUpload,
  getUploads,
  onUploaded,
  resumeSavedUploads,
  retryUpload,
  subscribeUploads,
  uploadsPending,
  type UploadJob,
} from "@/lib/uploadQueue";
import { cn } from "@/lib/utils";

const NONE: UploadJob[] = [];

export function useUploads(): UploadJob[] {
  return useSyncExternalStore(subscribeUploads, getUploads, () => NONE);
}

/**
 * Keeps the background uploads going for the whole app: picks up any that
 * didn't finish last time, refreshes the page as each one lands, and asks
 * before the tab is closed with some still on their way.
 */
export function UploadQueueWatcher({ userId }: { userId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    void resumeSavedUploads(userId);
  }, [userId]);

  useEffect(
    () =>
      onUploaded(() => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 900);
      }),
    [router]
  );

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!uploadsPending()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return <UploadPill />;
}

/** "Uploading 4 of 12" — above the bottom bar, wherever you are in the app. */
function UploadPill() {
  const jobs = useUploads();
  const path = usePathname();
  if (path === "/start" || !jobs.length) return null;
  const done = jobs.filter((j) => j.status === "done").length;
  const failed = jobs.filter((j) => j.status === "failed");
  const active = jobs.length - done - failed.length;
  if (!active && !failed.length) {
    return (
      <Pill>
        <Check size={15} className="text-emerald-400" aria-hidden /> All uploaded
      </Pill>
    );
  }
  if (!active) {
    return (
      <Pill>
        <AlertCircle size={15} className="text-red-300" aria-hidden />
        {failed.length} didn&rsquo;t upload
        <button type="button" onClick={() => failed.forEach((j) => retryUpload(j.id))} className="ml-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold hover:bg-white/25">
          Try again
        </button>
        <button type="button" onClick={() => failed.forEach((j) => dismissUpload(j.id))} aria-label="Dismiss" className="rounded-full p-1 text-white/70 hover:text-white">
          <X size={14} />
        </button>
      </Pill>
    );
  }
  return (
    <Pill>
      <Loader2 size={15} className="animate-spin text-accent" aria-hidden />
      Uploading {done + 1 > jobs.length ? jobs.length : done + 1} of {jobs.length}
    </Pill>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex w-max max-w-[calc(100%-2rem)] items-center gap-2 rounded-full bg-brand-purple/95 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-black/30 ring-1 ring-white/10 backdrop-blur"
    >
      {children}
    </div>
  );
}

/** A progress ring around 0–100. */
function Ring({ pct }: { pct: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90" aria-hidden>
      <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="3" />
      <circle cx="18" cy="18" r={r} fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0.04, pct / 100))} className="transition-[stroke-dashoffset] duration-300" />
    </svg>
  );
}

/**
 * The photos and videos of one trip or event that are still on their way
 * up — shown straight from the phone, so the page looks finished at once.
 */
export function QueuedMedia({ parentId, className }: { parentId: string; className?: string }) {
  const jobs = useUploads().filter((j) => j.target.parentId === parentId && j.status !== "done");
  if (!jobs.length) return null;
  return (
    <section className={cn(className)} aria-label="Uploading">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        {jobs.every((j) => j.status === "failed") ? (
          <>
            <AlertCircle size={15} className="text-red-700 dark:text-red-400" aria-hidden /> {jobs.length === 1 ? "This didn't" : "These didn't"} upload - try again, or remove
          </>
        ) : (
          <>
            <UploadCloud size={15} className="text-accent" aria-hidden /> Uploading {jobs.length} {jobs.length === 1 ? "memory" : "memories"} - you can carry on
          </>
        )}
      </p>
      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {jobs.map((j) => (
          <li key={j.id} className="relative aspect-square overflow-hidden rounded-xl bg-raised">
            {j.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={j.previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <video src={j.previewUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
            )}
            <span className={cn("absolute inset-0 flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-white", j.status === "failed" ? "bg-black/60" : "bg-black/35")}>
              {j.status === "failed" ? (
                <>
                  <AlertCircle size={18} aria-hidden />
                  <span className="px-2 text-center leading-tight">{j.error ?? "Didn't upload"}</span>
                  <span className="flex gap-1.5">
                    <button type="button" onClick={() => retryUpload(j.id)} aria-label="Try again" className="rounded-full bg-white/20 p-1.5 hover:bg-white/30">
                      <RotateCw size={13} />
                    </button>
                    <button type="button" onClick={() => dismissUpload(j.id)} aria-label="Remove" className="rounded-full bg-white/20 p-1.5 hover:bg-white/30">
                      <X size={13} />
                    </button>
                  </span>
                </>
              ) : (
                <>
                  <Ring pct={j.status === "uploading" ? j.progress : j.status === "preparing" && j.kind === "video" ? j.progress * 0.5 : 0} />
                  <span>
                    {j.status === "waiting"
                      ? "Waiting"
                      : j.status === "retrying"
                        ? "Reconnecting"
                        : j.status === "preparing"
                          ? j.kind === "video" && j.target.videoQuality !== "hd"
                            ? "Compressing"
                            : "Preparing"
                          : `${j.progress}%`}
                  </span>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Image as ImageIcon, MoreHorizontal, Music2, Trash2, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { StockPhoto } from "@/lib/stockPhotos";
import { ConfirmDialog } from "./ConfirmDialog";
import { StockImage } from "./StockImage";

/** One trip on your country page: its photo, when, where, and what you kept. */
export function TripCard({
  visitId,
  mediaPaths,
  href,
  title,
  days,
  subtitle,
  photos,
  videos,
  hasSoundtrack,
  photo,
  stock,
  priority,
}: {
  visitId: string;
  mediaPaths: string[];
  href: string;
  title: string;
  days: string | null;
  subtitle: string | null;
  photos: number;
  videos: number;
  hasSoundtrack: boolean;
  photo: string | null;
  stock: StockPhoto | null;
  priority?: boolean;
}) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  async function remove() {
    setRemoving(true);
    const supabase = createClient();
    const { error } = await supabase.from("country_visits").delete().eq("id", visitId);
    // The files go too, not just their rows.
    if (!error && mediaPaths.length) await supabase.storage.from("media").remove(mediaPaths);
    setConfirm(false);
    setRemoving(false);
    router.refresh();
  }

  const empty = photos === 0 && videos === 0;
  return (
    <div className="group relative h-44 overflow-hidden rounded-2xl bg-[#14110d] shadow-lg ring-1 ring-black/5 sm:h-52">
      {photo ? (
        <Image src={photo} alt="" fill priority={priority} sizes="(min-width: 768px) 720px, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
      ) : stock ? (
        <StockImage photo={stock} sizes="(min-width: 768px) 720px, 100vw" className="opacity-80 transition-transform duration-700 group-hover:scale-[1.03]" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-black/5" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" aria-hidden />

      <Link href={href} className="absolute inset-0" aria-label={`Open the trip: ${title}`} />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 pr-16 text-white sm:p-5 sm:pr-20">
        {days && <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">{days}</p>}
        <p className="font-serif text-[26px] leading-tight drop-shadow sm:text-3xl">{title}</p>
        <p className="mt-0.5 truncate text-sm text-white/85">{subtitle ?? (empty ? "Add your memories" : "")}</p>
        {!empty && (
          <p className="mt-2.5 flex items-center gap-2.5 text-xs text-white/85 sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <ImageIcon size={14} aria-hidden /> {photos} {photos === 1 ? "photo" : "photos"}
            </span>
            {videos > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Video size={14} aria-hidden /> {videos} {videos === 1 ? "video" : "videos"}
                </span>
              </>
            )}
            {hasSoundtrack && (
              <>
                <span aria-hidden>·</span>
                <Music2 size={13} aria-label="Has a soundtrack" />
              </>
            )}
          </p>
        )}
      </div>

      <span className="pointer-events-none absolute bottom-4 right-4 flex h-9 w-9 sm:bottom-5 sm:right-5 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/25 backdrop-blur transition-colors group-hover:bg-accent">
        <ChevronRight size={18} aria-hidden />
      </span>

      <div ref={menuRef} className="absolute right-3 top-3 sm:right-4 sm:top-4">
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-label={`More for ${title}`}
          aria-expanded={menu}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/45 text-white ring-1 ring-white/20 backdrop-blur hover:bg-black/60"
        >
          <MoreHorizontal size={18} />
        </button>
        {menu && (
          <div className="absolute right-0 top-12 z-10 w-44 overflow-hidden rounded-xl border border-line bg-surface py-1 text-sm shadow-xl">
            <Link href={href} className="block px-4 py-2.5 hover:bg-raised">
              Open trip
            </Link>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                setConfirm(true);
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-red-700 hover:bg-raised dark:text-red-400"
            >
              <Trash2 size={15} /> Remove trip
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirm}
        title={`Remove the ${days ?? title} trip?`}
        body="This trip's photos, cities and notes will be deleted from your archive. This cannot be undone."
        confirmLabel="Remove trip"
        busy={removing}
        onConfirm={remove}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}

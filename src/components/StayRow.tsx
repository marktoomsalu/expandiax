"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Home, Image as ImageIcon, MoreHorizontal, Plane, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { StockPhoto } from "@/lib/stockPhotos";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "./ConfirmDialog";
import { StockImage } from "./StockImage";

export type StayView = {
  id: string;
  name: string;
  kind: "trip" | "lived";
  places: string | null; // "Bled, Slovenia"
  when: string; // "8 – 10 Aug 2025"
  length: string | null; // "3 days"
  railTop: string | null; // "2025" — only where the year changes
  railBottom: string | null; // "AUG"
  photos: number;
  photo: string | null;
  stock: StockPhoto | null;
  mediaPaths: string[];
};

/** One row of a country's "All stays & trips" timeline. */
export function StayRow({ stay, href, first, last }: { stay: StayView; href: string; first: boolean; last: boolean }) {
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
    const { error } = await supabase.from("country_visits").delete().eq("id", stay.id);
    // The files go too, not just their rows.
    if (!error && stay.mediaPaths.length) await supabase.storage.from("media").remove(stay.mediaPaths);
    setConfirm(false);
    setRemoving(false);
    router.refresh();
  }

  const Icon = stay.kind === "lived" ? Home : Plane;
  return (
    <div className="flex items-stretch gap-2">
      {/* Timeline rail */}
      <div className="relative flex w-11 shrink-0 flex-col items-center pt-4 text-center">
        {stay.railTop && <span className="text-[11px] font-semibold leading-tight">{stay.railTop}</span>}
        {stay.railBottom && <span className="text-[10px] uppercase leading-tight text-muted">{stay.railBottom}</span>}
        <span className={cn("absolute right-0 top-0 w-px bg-line", first ? "top-6" : "top-0", last ? "h-6" : "bottom-0")} aria-hidden />
        <span
          className={cn("absolute -right-[5px] top-6 h-2.5 w-2.5 rounded-full ring-2 ring-canvas", stay.kind === "lived" ? "bg-accent" : "bg-sky-500")}
          aria-hidden
        />
      </div>

      <div className="relative min-w-0 flex-1 py-1.5">
        <div className="group relative flex items-center gap-3 rounded-2xl border border-line bg-surface p-2 pr-2 shadow-sm transition-colors hover:border-accent">
          <Link href={href} className="absolute inset-0" aria-label={`Open ${stay.name}`} />
          <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-raised">
            {stay.photo ? (
              <Image src={stay.photo} alt="" fill sizes="80px" className="object-cover" />
            ) : stay.stock ? (
              <StockImage photo={stay.stock} aspect="5:4" sizes="80px" />
            ) : null}
            <span className="absolute bottom-1 left-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-accent shadow">
              <Icon size={13} aria-hidden />
            </span>
          </span>
          <span className="pointer-events-none min-w-0 flex-1">
            <span className="block truncate font-serif text-base leading-tight sm:text-lg">{stay.name}</span>
            {stay.places && <span className="block truncate text-xs text-muted">{stay.places}</span>}
            <span className="block truncate text-xs text-muted">
              {stay.when}
              {stay.length ? ` · ${stay.length}` : ""}
            </span>
          </span>
          {stay.photos > 0 && (
            <span className="pointer-events-none hidden items-center gap-1 text-xs text-muted min-[400px]:flex">
              <ImageIcon size={14} aria-hidden /> {stay.photos}
            </span>
          )}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenu((m) => !m)}
              aria-label={`More for ${stay.name}`}
              aria-expanded={menu}
              className="relative flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink"
            >
              <MoreHorizontal size={18} />
            </button>
            {menu && (
              <div className="absolute right-0 top-9 z-10 w-40 overflow-hidden rounded-xl border border-line bg-surface py-1 text-sm shadow-xl">
                <Link href={`${href}/edit`} className="block px-4 py-2.5 hover:bg-raised">
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    setConfirm(true);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-red-700 hover:bg-raised dark:text-red-400"
                >
                  <Trash2 size={15} /> Remove
                </button>
              </div>
            )}
          </div>
          <ChevronRight size={16} className="pointer-events-none shrink-0 text-muted" aria-hidden />
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title={`Remove ${stay.name}?`}
        body="Its places, photos and notes will be deleted from your archive. This cannot be undone."
        confirmLabel="Remove"
        busy={removing}
        onConfirm={remove}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}

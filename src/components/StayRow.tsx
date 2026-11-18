"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Eye, Home, Image as ImageIcon, Lock, LogOut, MoreHorizontal, Pencil, Plane, SquareArrowOutUpRight, Trash2, Users } from "lucide-react";
import type { Audience } from "@/lib/audience";
import { createClient } from "@/lib/supabase/client";
import type { StockPhoto } from "@/lib/stockPhotos";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "./ConfirmDialog";
import { StockImage } from "./StockImage";

export type StayView = {
  id: string;
  name: string;
  kind: "trip" | "lived";
  /** A stay still going on ("I still live here"). */
  current?: boolean;
  /** A trip taken while living in this country: part of that stay, not another visit. */
  duringStay?: string | null;
  /** Shared with this person (migration 075): whose it is, whether they may edit it, and their part (to leave). */
  collab?: { ownerName: string; canEdit: boolean; collabId: string };
  places: string | null; // "Bled, Slovenia"
  when: string; // "8 – 10 Aug 2025"
  length: string | null; // "3 days"
  railTop: string | null; // "Jul" (when the month is known)
  railBottom: string | null; // "2024", on every row
  photos: number;
  /** Who sees it: Feed (everyone), Friends, or Only me. */
  audience: Audience;
  photo: string | null;
  stock: StockPhoto | null;
  mediaPaths: string[];
};

/**
 * One row of a country's "All stays & trips" timeline. `readOnly`: someone
 * else's, with no Edit or Remove. `expand`: the row opens in place to show
 * its memories (`children`) instead of going to another page.
 */
export function StayRow({
  stay,
  href,
  first,
  last,
  readOnly = false,
  expand,
  children,
}: {
  stay: StayView;
  href: string;
  first: boolean;
  last: boolean;
  readOnly?: boolean;
  expand?: { open: boolean; onToggle: () => void };
  children?: React.ReactNode;
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
    // Shared with you: leaving takes it off your page; it stays for everyone else.
    if (stay.collab) {
      await createClient().rpc("remove_collab", { p_id: stay.collab.collabId });
      setConfirm(false);
      setRemoving(false);
      router.refresh();
      return;
    }
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
        {stay.railBottom && <span className={cn("leading-tight", stay.railTop ? "text-[10px] text-muted" : "text-[11px] font-semibold")}>{stay.railBottom}</span>}
        <span className={cn("absolute right-0 top-0 w-px bg-line", first ? "top-6" : "top-0", last ? "h-6" : "bottom-0")} aria-hidden />
        <span
          className={cn("absolute -right-[5px] top-6 h-2.5 w-2.5 rounded-full ring-2 ring-canvas", stay.kind === "lived" ? "bg-[#fa51a2]" : "bg-[#fb7822]")}
          aria-hidden
        />
      </div>

      <div className="relative min-w-0 flex-1 py-1.5">
        <div className="group relative flex items-center gap-3 rounded-2xl border border-line bg-surface p-2 pr-2 shadow-sm transition-colors hover:border-accent">
          {expand ? (
            <button
              type="button"
              onClick={expand.onToggle}
              aria-expanded={expand.open}
              aria-label={`${expand.open ? "Close" : "Open"} ${stay.name}`}
              className="absolute inset-0 rounded-2xl"
            />
          ) : (
            <Link href={href} className="absolute inset-0" aria-label={`Open ${stay.name}`} />
          )}
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
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-serif text-base leading-tight sm:text-lg">{stay.name}</span>
              {stay.collab && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">
                  <Users size={9} aria-hidden /> with {stay.collab.ownerName.split(" ")[0]}
                </span>
              )}
              {stay.current && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-[#fa51a2]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#d6337f] dark:text-[#ff7cbd]">Now</span>
              )}
              {stay.audience !== "everyone" && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-raised px-1.5 py-0.5 text-[10px] font-medium text-muted">
                  {stay.audience === "friends" ? <Users size={9} aria-hidden /> : <Lock size={9} aria-hidden />}
                  {stay.audience === "friends" ? "Friends" : "Only me"}
                </span>
              )}
            </span>
            {stay.duringStay && (
              <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-medium text-[#d6337f] dark:text-[#ff7cbd]">
                <Home size={10} className="shrink-0" aria-hidden /> While living here · {stay.duringStay}
              </span>
            )}
            {stay.places && stay.places !== stay.name && <span className="block truncate text-xs text-muted">{stay.places}</span>}
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
          {!readOnly && (
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
              <div className="absolute right-0 top-9 z-10 w-52 overflow-hidden rounded-xl border border-line bg-surface py-1 text-sm shadow-xl">
                <Link href={href} className="flex items-center gap-2 px-4 py-2.5 hover:bg-raised">
                  <SquareArrowOutUpRight size={15} /> Open
                </Link>
                {(!stay.collab || stay.collab.canEdit) && (
                  <Link href={`${href}/edit`} className="flex items-center gap-2 px-4 py-2.5 hover:bg-raised">
                    <Pencil size={15} /> Edit
                  </Link>
                )}
                {stay.collab ? (
                  // Shared with you: who sees it is its owner's to say; you can leave it.
                  <>
                    <div className="border-t border-line" />
                    <button
                      type="button"
                      onClick={() => {
                        setMenu(false);
                        setConfirm(true);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-red-700 hover:bg-raised dark:text-red-400"
                    >
                      <LogOut size={15} /> Leave
                    </button>
                  </>
                ) : (
                  <>
                    {/* Who can see it and Show in feed, together on the edit page. */}
                    <Link href={`${href}/edit#visibility`} className="flex items-center gap-2 px-4 py-2.5 hover:bg-raised">
                      <Eye size={15} />
                      <span className="flex-1">Visibility</span>
                      <span className="text-xs text-muted">{stay.audience === "everyone" ? "Everyone" : stay.audience === "friends" ? "Friends" : "Only me"}</span>
                    </Link>
                    <div className="border-t border-line" />
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
                  </>
                )}
              </div>
            )}
          </div>
          )}
          {/* Opening in place (someone else's page) shows which way it goes; your own cards just open on tap. */}
          {expand && (
            <ChevronRight
              size={16}
              className={cn("pointer-events-none shrink-0 text-muted transition-transform duration-200", expand.open && "rotate-90 text-accent")}
              aria-hidden
            />
          )}
        </div>
        {expand?.open && children}
      </div>

      {!readOnly && (
      <ConfirmDialog
        open={confirm}
        title={stay.collab ? `Leave ${stay.name}?` : `Remove ${stay.name}?`}
        body={stay.collab ? `It comes off your profile and Countries. It stays ${stay.collab.ownerName.split(" ")[0]}'s, and for everyone else on it.` : "Its places, photos and notes will be deleted from your memories. This cannot be undone."}
        confirmLabel={stay.collab ? "Leave" : "Remove"}
        busy={removing}
        onConfirm={remove}
        onCancel={() => setConfirm(false)}
      />
      )}
    </div>
  );
}

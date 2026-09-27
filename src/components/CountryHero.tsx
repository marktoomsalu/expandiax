"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Globe2, Heart, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { StockPhoto } from "@/lib/stockPhotos";
import { cn } from "@/lib/utils";
import { ShareButton } from "./ShareButton";
import { StockCredit } from "./StockCredit";
import { StockImage } from "./StockImage";

/**
 * The top of your own country page: your best photo of the place (or a
 * credited stock one until you add yours), the country, how much you've
 * kept, and Share · Public page · Favourite.
 */
export function CountryHero({
  visitedCountryId,
  flag,
  name,
  continent,
  isTerritory,
  onlyMe,
  trips,
  memories,
  photo,
  stock,
  publicHref,
  initialFavourite,
}: {
  visitedCountryId: string;
  flag: string;
  name: string;
  continent: string;
  isTerritory: boolean;
  onlyMe: boolean;
  trips: number;
  memories: number;
  photo: string | null;
  stock: StockPhoto | null;
  publicHref: string | null;
  initialFavourite: boolean;
}) {
  const router = useRouter();
  const [favourite, setFavourite] = useState(initialFavourite);
  const [busy, setBusy] = useState(false);

  async function toggleFavourite() {
    setBusy(true);
    const next = !favourite;
    setFavourite(next);
    const { error } = await createClient().from("visited_countries").update({ is_favourite: next }).eq("id", visitedCountryId);
    if (error) setFavourite(!next);
    setBusy(false);
    router.refresh();
  }

  const action = "inline-flex items-center gap-2 text-sm font-medium text-white/90 transition-colors hover:text-white";
  return (
    <div className="relative -mt-px h-[62vh] max-h-[560px] min-h-[380px] w-full overflow-hidden bg-[#14110d]">
      {photo ? (
        <Image src={photo} alt={`Photo from ${name}`} fill priority sizes="100vw" className="object-cover" />
      ) : stock ? (
        <StockImage photo={stock} alt={stock.alt} priority sizes="100vw" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/25" aria-hidden />

      <div className="absolute inset-x-0 top-0 mx-auto flex max-w-3xl items-center justify-between px-5 pt-5">
        <Link href="/my-world" className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-black/50">
          <ArrowLeft size={15} /> My World
        </Link>
        {!photo && stock && (
          <span className="rounded-full bg-black/35 px-2.5 py-1.5 backdrop-blur-sm">
            <StockCredit photo={stock} />
          </span>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl px-5 pb-6 text-white">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/75">
          {continent}
          {isTerritory && <span className="rounded-full border border-white/40 px-2 py-0.5 text-[0.625rem] normal-case tracking-normal">Territory</span>}
          {onlyMe && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[0.625rem] normal-case tracking-normal">
              <Lock size={10} /> Only me
            </span>
          )}
        </p>
        <h1 className="mt-2 flex items-center gap-3 font-serif text-5xl leading-none drop-shadow-md sm:text-6xl">
          <span aria-hidden className="text-[0.8em]">
            {flag}
          </span>
          {name}
        </h1>
        <p className="mt-3 text-base text-white/80">
          {trips} {trips === 1 ? "trip" : "trips"} · {memories > 0 ? `${memories} ${memories === 1 ? "memory" : "memories"}` : "no photos yet"}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <ShareButton kind="country" targetId={visitedCountryId} title={`${flag} ${name}`} compact className="!text-white/90 hover:!text-white" />
          {publicHref && (
            <>
              <span className="h-5 w-px bg-white/25" aria-hidden />
              <Link href={publicHref} className={action}>
                <Globe2 size={18} className="text-accent" /> Public page
              </Link>
            </>
          )}
          <span className="h-5 w-px bg-white/25" aria-hidden />
          <button type="button" onClick={toggleFavourite} disabled={busy} aria-pressed={favourite} className={action}>
            <Heart size={18} className={cn(favourite && "fill-accent text-accent")} />
            Favourite
          </button>
        </div>
      </div>
    </div>
  );
}

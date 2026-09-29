import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { flagGradientColors } from "@/lib/flagColors";
import { slugify } from "@/lib/explore";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { loadTravellers, networkRows, travellerCounts } from "@/lib/experienceNetworkData";
import { NetworkRows } from "@/components/network/NetworkRows";
import { DreamButton } from "@/components/network/DreamButton";
import { StockImage } from "@/components/StockImage";
import { StockCredit } from "@/components/StockCredit";
import { MembersOnly } from "@/components/MembersOnly";
import { PartnerNote, TripLinks } from "@/components/TripLinks";

type Params = { code: string; town: string };

export function generateMetadata({ params }: { params: Params }) {
  const country = countryByCode(params.code);
  const town = decodeURIComponent(params.town).replace(/-/g, " ");
  return { title: country ? `${town.charAt(0).toUpperCase()}${town.slice(1)}, ${country.name}` : "Explore" };
}

/** A town, as the experience network knows it: who's been, and who to ask. */
export default async function TownPage({ params }: { params: Params }) {
  const country = countryByCode(params.code);
  if (!country) notFound();
  const slug = slugify(decodeURIComponent(params.town));
  const supabase = createClient();
  const viewer = await getAuthUser();

  const [{ travellers, home, dreams, townName }, counts] = await Promise.all([
    loadTravellers(supabase, viewer?.id ?? null, country.code, slug),
    travellerCounts(supabase, country.code),
  ]);
  const counted = [...counts.towns.values()].find((t) => slugify(t.name) === slug);
  const name = townName ?? counted?.name;
  if (!name) notFound();

  const total = Math.max(counted?.n ?? 0, travellers.length);
  const network = travellers.filter((t) => t.following).length;
  const rows = networkRows(travellers, home, country.code);
  const dreaming = dreams.some((w) => w.country_code === country.code && slugify(w.place_name) === slug);
  const photo = stockPhotoFor(country.code, slug);
  const [a, b] = flagGradientColors(country.code);
  const base = `/explore/place/${country.code.toLowerCase()}/${slug}`;

  return (
    <div>
      <div className="relative h-[34vh] min-h-60 w-full overflow-hidden" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
        {photo && <StockImage photo={photo} alt={photo.alt} priority sizes="100vw" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/10" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl px-5 pb-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">
            {country.flag} {country.name}
          </p>
          <h1 className="mt-1 text-5xl drop-shadow">{name}</h1>
          {total > 0 && (
            <p className="mt-1 text-sm text-white/85">
              {total.toLocaleString("en-GB")} {total === 1 ? "traveller has" : "travellers have"} been here
              {network > 0 && ` · ${network} from your network`}
            </p>
          )}
        </div>
        {photo && (
          <span className="absolute right-4 top-4 rounded-full bg-black/40 px-2.5 py-1.5 backdrop-blur-sm">
            <StockCredit photo={photo} />
          </span>
        )}
      </div>

      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/explore/country/${country.code.toLowerCase()}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft size={15} /> {country.name}
          </Link>
          {viewer && <DreamButton target={{ kind: "place", countryCode: country.code, placeName: name }} label={name} initial={dreaming} />}
        </div>
        <TripLinks place={`${name}, ${country.name}`} size="large" className="mt-4" />
        <PartnerNote className="mt-1.5" />

        <section className="mt-10" aria-labelledby="tv-h">
          <h2 id="tv-h" className="flex items-center gap-2 text-2xl">
            <Users size={20} className="text-accent" aria-hidden /> Who&rsquo;s been to {name}
          </h2>
          <p className="mt-1 text-sm text-muted">Ask them where to go - people you follow first.</p>
          <div className="mt-4">
            {!viewer ? (
              <MembersOnly count={total} next={base} />
            ) : rows.length ? (
              <NetworkRows rows={rows} />
            ) : (
              <p className="text-sm text-muted">
                {total > 0 ? `${total} ${total === 1 ? "traveller has" : "travellers have"} been here, but their trips aren't shared with you.` : `Nobody has shared ${name} yet.`}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

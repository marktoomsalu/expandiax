import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Image as ImageIcon } from "lucide-react";
import { StockCredit } from "@/components/StockCredit";
import { StockImage } from "@/components/StockImage";
import { stockPhotoFor } from "@/lib/stockPhotos";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { VisitEditor } from "@/components/VisitEditor";
import { MediaUploader } from "@/components/MediaUploader";
import { ShareButton } from "@/components/ShareButton";
import { PHOTO_CAP, VIDEO_CAP } from "@/lib/plan";
import { tripTitle } from "@/lib/tripTitle";
import type { CountryCity, CountryMedia, CountryVisit, Plan } from "@/lib/types";
import { signMedia } from "@/lib/signedMedia";

type VisitRow = CountryVisit & {
  visited_countries: { id: string; user_id: string; country_code: string; is_public: boolean; share_to_feed: boolean };
  country_media: CountryMedia[];
  country_cities: CountryCity[];
};

export const metadata = { title: "Edit trip" };

export default async function VisitPage({
  params,
  searchParams,
}: {
  params: { code: string; visitId: string };
  searchParams: { created?: string };
}) {
  const meta = countryByCode(params.code);
  if (!meta) notFound();

  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const [{ data }, { data: profile }] = await Promise.all([
    supabase
      .from("country_visits")
      .select("*, visited_countries!inner(id, user_id, country_code, is_public, share_to_feed), country_media!country_media_country_visit_id_fkey(*), country_cities(*)")
      .eq("id", params.visitId)
      .eq("visited_countries.user_id", user.id)
      .eq("visited_countries.country_code", meta.code)
      .maybeSingle(),
    supabase.from("profiles").select("plan").eq("id", user.id).single(),
  ]).then((r) => signMedia(r));

  if (!data) notFound();
  const visit = data as VisitRow;
  const plan = (profile?.plan ?? "free") as Plan;
  const images = visit.country_media.filter((m) => m.media_type === "image").sort((a, b) => a.display_order - b.display_order);
  const cover = images.find((m) => m.id === visit.cover_media_id) ?? images[0];
  const stock = cover ? null : stockPhotoFor(meta.code, visit.id);
  const photos = images.length;
  const videos = visit.country_media.length - photos;
  const cities = visit.country_cities.map((c) => c.city_name);
  const title = tripTitle(visit);

  return (
    <div className="mx-auto max-w-2xl px-5 pb-16 pt-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/my-world/${meta.code.toLowerCase()}`}
          aria-label={`Back to ${meta.name}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface hover:border-accent"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0">
          <h1 className="font-serif text-3xl leading-tight sm:text-4xl">Edit trip</h1>
          <p className="truncate text-sm text-muted">
            {meta.name} · {title.headline}
            {title.days ? ` · ${title.days}` : ""}
          </p>
        </div>
      </div>

      {searchParams.created && (
        <p role="status" className="mt-5 rounded-2xl border border-accent/40 bg-accent-soft/50 px-4 py-3 text-sm">
          Added to your map. Add more whenever you like - a soundtrack, more photos, the story behind it.
        </p>
      )}

      {/* The trip's cover — or a credited stock photo until you add yours */}
      <div className="relative mt-5 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-[#14110d] shadow-lg ring-1 ring-black/5">
        {cover ? (
          <Image src={cover.public_url} alt="" fill priority sizes="(min-width: 672px) 672px, 100vw" className="object-cover" />
        ) : stock ? (
          <StockImage photo={stock} alt={stock.alt} priority sizes="(min-width: 672px) 672px, 100vw" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" aria-hidden />
        {stock && (
          <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-1.5 backdrop-blur-sm">
            <StockCredit photo={stock} />
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white sm:p-5">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-serif text-xl leading-tight drop-shadow sm:text-2xl">
              <span aria-hidden>{meta.flag}</span> {cities.length ? cities.slice(0, 3).join(", ") : `${meta.name} trip`}
            </p>
            <p className="mt-1 text-sm text-white/80">
              {photos} {photos === 1 ? "photo" : "photos"} · {videos}/{VIDEO_CAP[plan]} videos
            </p>
          </div>
          <a
            href="#photos"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black/45 px-3.5 py-2 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur hover:bg-black/60"
          >
            <ImageIcon size={16} aria-hidden /> {cover ? "Change" : "Add cover"}
          </a>
        </div>
      </div>

      <div id="photos" className="mt-4 scroll-mt-24">
        <MediaUploader
          userId={user.id}
          scope="countries"
          parentId={visit.id}
          table="country_media"
          fkColumn="country_visit_id"
          extraFields={{ visited_country_id: visit.visited_country_id }}
          photoCap={PHOTO_CAP[plan]}
          videoCap={VIDEO_CAP[plan]}
          items={visit.country_media}
          coverId={visit.cover_media_id}
          coverTable="country_visits"
          captions
          label="Your photos & videos"
          showUpgradeHint={plan === "free"}
          tiles
        />
      </div>

      <div className="mt-6">
        <VisitEditor
          visit={visit}
          cities={visit.country_cities}
          country={{
            id: visit.visited_countries.id,
            code: meta.code,
            name: meta.name,
            is_public: visit.visited_countries.is_public,
            share_to_feed: visit.visited_countries.share_to_feed,
          }}
        />
      </div>

      <div className="mt-8 flex items-center justify-center">
        <ShareButton kind="country" targetId={visit.visited_country_id} title={`${meta.flag} ${meta.name}`} />
      </div>
    </div>
  );
}

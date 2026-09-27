import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Image as ImageIcon, Video } from "lucide-react";
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
  visited_countries: { id: string; user_id: string; country_code: string };
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
      .select("*, visited_countries!inner(id, user_id, country_code), country_media!country_media_country_visit_id_fkey(*), country_cities(*)")
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
    <div>
      {/* The trip's own photo on top — or a credited stock one until you add yours */}
      <div className="relative -mt-px h-[46vh] max-h-[440px] min-h-[300px] w-full overflow-hidden bg-[#14110d]">
        {cover ? (
          <Image src={cover.public_url} alt="" fill priority sizes="100vw" className="object-cover" />
        ) : stock ? (
          <StockImage photo={stock} alt={stock.alt} priority sizes="100vw" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/25" aria-hidden />
        <div className="absolute inset-x-0 top-0 mx-auto flex max-w-2xl items-center justify-between px-5 pt-5">
          <Link
            href={`/my-world/${meta.code.toLowerCase()}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-black/50"
          >
            <ArrowLeft size={15} /> {meta.flag} {meta.name}
          </Link>
          {stock && (
            <span className="rounded-full bg-black/35 px-2.5 py-1.5 backdrop-blur-sm">
              <StockCredit photo={stock} />
            </span>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-2xl px-5 pb-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/75">
            {meta.flag} {meta.name} · Trip
          </p>
          {title.days && <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">{title.days}</p>}
          <h1 className={`${title.days ? "mt-1" : "mt-2"} font-serif text-4xl leading-none drop-shadow-md`}>{title.headline}</h1>
          {cities.length > 0 && <p className="mt-2 truncate text-base text-white/85">{cities.join(", ")}</p>}
          <p className="mt-3 flex items-center gap-3 text-sm text-white/80">
            <span className="inline-flex items-center gap-1.5">
              <ImageIcon size={16} aria-hidden /> {photos} {photos === 1 ? "photo" : "photos"}
            </span>
            {videos > 0 && (
              <span className="inline-flex items-center gap-1.5">
                · <Video size={16} aria-hidden /> {videos} {videos === 1 ? "video" : "videos"}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-5 pb-16 pt-8">
        {searchParams.created && (
          <p role="status" className="mt-6 rounded-lg border border-accent/40 bg-accent-soft/50 px-4 py-3 text-sm">
            Added to your map. Add more whenever you like - a soundtrack, more photos, the story behind it.
          </p>
        )}

        <div className={searchParams.created ? "mt-8" : ""}>
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
            label="Photos & videos from this trip"
            showUpgradeHint={plan === "free"}
          />
        </div>

        <div className="mt-8">
          <VisitEditor visit={visit} cities={visit.country_cities} />
        </div>

        <div className="mt-10 flex items-center justify-center border-t border-line pt-6">
          <ShareButton kind="country" targetId={visit.visited_country_id} title={`${meta.flag} ${meta.name}`} />
        </div>
      </div>
    </div>
  );
}

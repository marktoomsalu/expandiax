import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { RatingStars } from "@/components/Rating";
import { ReportButton } from "@/components/ReportButton";
import { formatDate, formatVisitRange } from "@/lib/utils";
import type { Event, VisitedCountryFull } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: { username: string; code: string };
}): Promise<Metadata> {
  const meta = countryByCode(params.code);
  if (!meta) return { title: "Country" };

  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", params.username.toLowerCase())
    .maybeSingle();
  if (!profile) return { title: meta.name };

  const { data: country } = await supabase
    .from("visited_countries")
    .select("note, cover_media_id, country_media!country_media_visited_country_id_fkey(id, public_url)")
    .eq("user_id", profile.id)
    .eq("country_code", meta.code)
    .maybeSingle();

  const title = `${meta.flag} ${meta.name} — ${profile.display_name}`;
  const description = country?.note || `${profile.display_name}'s memories from ${meta.name} on ExpandiaX.`;
  const cover = country?.country_media.find((m) => m.id === country.cover_media_id) ?? country?.country_media[0];

  return {
    title,
    description,
    openGraph: { title, description, images: cover ? [cover.public_url] : undefined },
    twitter: { title, description },
  };
}

export default async function PublicCountryPage({
  params,
}: {
  params: { username: string; code: string };
}) {
  const meta = countryByCode(params.code);
  if (!meta) notFound();

  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", params.username.toLowerCase())
    .maybeSingle();
  if (!profile) notFound();

  const [{ data }, { data: allCountries }, { data: relatedEvents }] = await Promise.all([
    supabase
      .from("visited_countries")
      .select("*, country_visits(*), country_cities(*), country_media!country_media_visited_country_id_fkey(*)")
      .eq("user_id", profile.id)
      .eq("country_code", meta.code)
      .maybeSingle(),
    supabase
      .from("visited_countries")
      .select("country_code, country_name")
      .eq("user_id", profile.id)
      .order("country_name"),
    supabase
      .from("events")
      .select("*")
      .eq("user_id", profile.id)
      .eq("country_code", meta.code)
      .eq("is_public", true)
      .order("event_date", { ascending: false }),
  ]);

  const country = data as VisitedCountryFull | null;
  if (!country) notFound();

  const media = [...country.country_media].sort((a, b) => a.display_order - b.display_order);
  const cover = media.find((m) => m.id === country.cover_media_id) ?? media[0];
  const rest = media.filter((m) => m.id !== cover?.id);
  const years = [...new Set(country.country_visits.map((v) => v.year))].sort();
  const highlightedVisits = [...country.country_visits]
    .filter((v) => v.highlight.trim())
    .sort((a, b) => a.year - b.year);
  const cities = country.country_cities.map((c) => c.city_name);
  const events = (relatedEvents ?? []) as Event[];

  const list = allCountries ?? [];
  const idx = list.findIndex((c) => c.country_code === meta.code);
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;

  return (
    <div>
      {cover && (
        <div className="relative h-[42vh] min-h-64 w-full overflow-hidden">
          <Image
            src={cover.public_url}
            alt={cover.caption || `Photo from ${meta.name}`}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" aria-hidden />
        </div>
      )}

      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link href={`/u/${profile.username}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} /> {profile.display_name}&rsquo;s world
        </Link>

        <p className="eyebrow mt-8">{meta.continent}{years.length > 0 && <> · {years.join(" · ")}</>}</p>
        <h1 className="mt-2 text-4xl md:text-5xl">
          <span aria-hidden className="mr-2">{meta.flag}</span>{meta.name}
        </h1>
        {cities.length > 0 && <p className="mt-3 text-sm text-muted">{cities.join(" · ")}</p>}

        {country.note && (
          <blockquote className="mt-8 border-l-2 border-accent pl-5 font-serif text-xl italic leading-relaxed md:text-2xl">
            &ldquo;{country.note}&rdquo;
          </blockquote>
        )}

        {highlightedVisits.length > 0 && (
          <section className="mt-10" aria-label="Visit highlights">
            <ul className="space-y-4">
              {highlightedVisits.map((v) => (
                <li key={v.id} className="border-l-2 border-line pl-5">
                  <p className="eyebrow">{formatVisitRange(v)}</p>
                  <p className="mt-1 text-sm leading-relaxed">{v.highlight}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {rest.length > 0 && (
          <section className="mt-10" aria-label="Photo gallery">
            <div className="grid grid-cols-2 gap-3">
              {rest.map((m) => (
                <div key={m.id} className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line">
                  <Image
                    src={m.public_url}
                    alt={m.caption || `Photo from ${meta.name}`}
                    fill
                    sizes="50vw"
                    loading="lazy"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {events.length > 0 && (
          <section className="mt-12" aria-labelledby="rel-h">
            <h2 id="rel-h" className="text-xl">Events in {meta.name}</h2>
            <ul className="mt-4 space-y-3">
              {events.map((e) => (
                <li key={e.id}>
                  <Link href={`/u/${profile.username}/events/${e.id}`} className="card group flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-serif group-hover:text-accent">{e.title}</p>
                      <p className="text-xs text-muted">{formatDate(e.event_date)} · {[e.venue, e.city].filter(Boolean).join(", ")}</p>
                    </div>
                    <RatingStars value={e.rating} size={13} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav aria-label="Other countries" className="mt-14 flex items-center justify-between border-t border-line pt-6 text-sm">
          {prev ? (
            <Link href={`/u/${profile.username}/countries/${prev.country_code.toLowerCase()}`} className="inline-flex items-center gap-1.5 text-muted hover:text-accent">
              <ArrowLeft size={14} /> {prev.country_name}
            </Link>
          ) : <span />}
          {next ? (
            <Link href={`/u/${profile.username}/countries/${next.country_code.toLowerCase()}`} className="inline-flex items-center gap-1.5 text-muted hover:text-accent">
              {next.country_name} <ArrowRight size={14} />
            </Link>
          ) : <span />}
        </nav>

        <div className="mt-6 flex justify-center">
          <ReportButton targetType="country" targetId={country.id} targetUrl={`/u/${profile.username}/countries/${meta.code.toLowerCase()}`} />
        </div>
      </div>
    </div>
  );
}

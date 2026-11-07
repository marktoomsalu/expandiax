import Link from "next/link";
import { CalendarHeart, Hourglass, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { MONTH_SHORT, alsoLoved, bestMonths, describeStay, monthCounts, typicalStay, type VisitFacts } from "@/lib/placeInsights";
import type { PlaceSponsor } from "@/lib/sponsors";

/**
 * "Trip notes" for a country, from everyone's public trips there: the best
 * time to go, how long people stay, and where else they love. Shows only
 * the notes there's enough behind.
 */
export async function PlaceInsights({ code }: { code: string }) {
  const supabase = createClient();
  const [{ data: visitRows }, { data: here }] = await Promise.all([
    supabase
      .from("country_visits")
      .select("kind, visited_from, visited_to, date_precision, visited_countries!inner(country_code, is_public)")
      .eq("visited_countries.country_code", code)
      .eq("visited_countries.is_public", true)
      .limit(3000),
    supabase.from("visited_countries").select("user_id").eq("country_code", code).eq("is_public", true).limit(1000),
  ]);
  const ids = [...new Set((here ?? []).map((r) => r.user_id))].slice(0, 200);
  const { data: theirs } = ids.length
    ? await supabase.from("visited_countries").select("user_id, country_code").in("user_id", ids).eq("is_public", true).limit(10000)
    : { data: [] as { user_id: string; country_code: string }[] };

  const visits = (visitRows ?? []) as unknown as VisitFacts[];
  const counts = monthCounts(visits);
  const best = bestMonths(counts);
  const stay = typicalStay(visits);
  const loved = alsoLoved(theirs ?? [], code);
  if (!best && !stay && !loved.length) return null;
  const peak = Math.max(...counts, 1);
  const trips = visits.filter((v) => v.kind === "trip").length;

  return (
    <section aria-labelledby="notes-h" className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-line px-5 py-3">
        <h2 id="notes-h" className="font-serif text-xl">
          Trip notes
        </h2>
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
          from {trips} {trips === 1 ? "trip" : "trips"}
        </p>
      </div>
      <div className="grid divide-y divide-dashed divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {best && (
          <div className="px-5 py-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <CalendarHeart size={14} className="text-accent" aria-hidden /> Best time to go
            </p>
            <p className="mt-1 font-serif text-2xl">{best.map((m) => MONTH_SHORT[m]).join(" · ")}</p>
            <div className="mt-3 flex h-10 items-end gap-1" aria-hidden>
              {counts.map((n, m) => (
                <span key={m} className="flex flex-1 flex-col items-center gap-1">
                  <span
                    className={`w-full rounded-sm ${best.includes(m) ? "gradient-travel" : "bg-raised"}`}
                    style={{ height: `${Math.max(8, (n / peak) * 100)}%` }}
                  />
                  <span className={`text-[9px] ${best.includes(m) ? "font-semibold text-accent" : "text-muted"}`}>{MONTH_SHORT[m].charAt(0)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {stay && (
          <div className="px-5 py-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <Hourglass size={14} className="text-accent" aria-hidden /> Most trips last
            </p>
            <p className="mt-1 font-serif text-2xl">{describeStay(stay)}</p>
          </div>
        )}
      </div>
      {loved.length > 0 && (
        <div className="border-t border-dashed border-line px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <Sparkles size={14} className="text-accent" aria-hidden /> People who went here also loved
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {loved.map((l) => {
              const c = countryByCode(l.code);
              if (!c) return null;
              return (
                <li key={l.code}>
                  <Link href={`/explore/country/${c.code.toLowerCase()}`} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm hover:border-accent">
                    <span aria-hidden>{c.flag}</span> {c.name}
                    <span className="text-xs text-muted">{l.people}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

/** A paid placement on a country page — always labelled, one at most. */
export function PartnerCard({ s }: { s: PlaceSponsor }) {
  return (
    <aside aria-label={`Partner: ${s.partner}`} className="mt-6 overflow-hidden rounded-2xl border border-accent/30 bg-surface">
      {s.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.image} alt="" className="aspect-[16/7] w-full object-cover" loading="lazy" />
      )}
      <div className="px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Partner · {s.partner}</p>
        <p className="mt-1 font-serif text-xl">{s.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
        <a href={s.url} target="_blank" rel="sponsored noopener noreferrer" className="btn-accent mt-3 inline-flex !py-2 text-sm">
          {s.cta}
        </a>
      </div>
    </aside>
  );
}

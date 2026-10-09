import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { CONTINENTS, countryByCode } from "@/lib/countries";
import { loadNetworkPlaces } from "@/lib/experienceNetworkData";
import { PlaceCardBig } from "@/components/network/FeedExplore";
import { cn } from "@/lib/utils";

export const metadata = { title: "Places" };

const COPY = {
  friends: { title: "Places your friends know", sub: "Where friends - people you follow who follow you back - have been." },
  network: { title: "Places your network has been to", sub: "Where others you follow have been." },
};

type Params = { circle?: string; q?: string; continent?: string };

/** "See all" for the Explore tab's place rows: every town, searchable and by continent. */
export default async function NetworkPlacesPage({ searchParams }: { searchParams?: Params }) {
  const user = await getAuthUser();
  if (!user) redirect("/sign-in?next=/explore/places");

  const circle = searchParams?.circle === "network" ? "network" : "friends";
  const q = (searchParams?.q ?? "").trim();
  const continent = CONTINENTS.find((c) => c === searchParams?.continent) ?? null;

  const all = await loadNetworkPlaces(createClient(), user.id);
  const list = all[circle];
  const continentOf = (code: string) => countryByCode(code)?.continent ?? null;
  const present = CONTINENTS.filter((c) => list.some((p) => continentOf(p.country) === c));
  const needle = q.toLowerCase();
  const shown = list.filter(
    (p) =>
      (!continent || continentOf(p.country) === continent) &&
      (!needle || p.name.toLowerCase().includes(needle) || (countryByCode(p.country)?.name.toLowerCase().includes(needle) ?? false))
  );

  const href = (next: Params) => {
    const qs = new URLSearchParams();
    const merged = { circle, q, continent: continent ?? "", ...next };
    if (merged.circle !== "friends") qs.set("circle", merged.circle!);
    if (merged.q) qs.set("q", merged.q);
    if (merged.continent) qs.set("continent", merged.continent);
    const s = qs.toString();
    return `/explore/places${s ? `?${s}` : ""}`;
  };
  const chip = (on: boolean) =>
    cn(
      "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
      on ? "border-accent bg-accent text-white" : "border-line bg-surface text-muted hover:border-accent/50 hover:text-ink"
    );

  return (
    <div className="mx-auto max-w-2xl px-5 py-6">
      <Link href="/feed?tab=explore" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> Explore
      </Link>
      <h1 className="mt-4 text-3xl md:text-4xl">{COPY[circle].title}</h1>
      <p className="mt-1.5 text-sm text-muted">{COPY[circle].sub}</p>

      <nav aria-label="Whose places" className="mt-5 flex rounded-full border border-line bg-surface p-1">
        {(["friends", "network"] as const).map((c) => (
          <Link
            key={c}
            href={href({ circle: c, continent: "" })}
            aria-current={c === circle ? "page" : undefined}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-colors",
              c === circle ? "bg-accent text-white shadow-md shadow-accent/25" : "text-muted hover:text-ink"
            )}
          >
            {c === "friends" ? "Friends" : "Your network"}
            <span className={c === circle ? "text-white/80" : "text-muted"}>{all[c].length}</span>
          </Link>
        ))}
      </nav>

      <form action="/explore/places" role="search" className="relative mt-3">
        {circle !== "friends" && <input type="hidden" name="circle" value={circle} />}
        {continent && <input type="hidden" name="continent" value={continent} />}
        <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input name="q" type="search" defaultValue={q} placeholder="Search a town or country…" aria-label="Search places" className="field !rounded-full !py-2.5 !pl-11" />
      </form>

      {present.length > 1 && (
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
          <Link href={href({ continent: "" })} className={chip(!continent)}>
            All
          </Link>
          {present.map((c) => (
            <Link key={c} href={href({ continent: c })} className={chip(continent === c)}>
              {c}
            </Link>
          ))}
        </div>
      )}

      {shown.length > 0 ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {shown.map((p) => (
            <PlaceCardBig key={p.key} p={p} wide />
          ))}
        </ul>
      ) : (
        <p className="mt-10 text-center text-sm text-muted">
          {list.length === 0
            ? circle === "friends"
              ? "No friends' places yet - they show up here as people you follow, who follow you back, add their trips."
              : "No places yet - they show up here as people you follow add their trips."
            : `Nothing matches${q ? ` “${q}”` : ""}${continent ? ` in ${continent}` : ""}.`}
        </p>
      )}
    </div>
  );
}

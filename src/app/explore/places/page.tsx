import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { loadCircleCountries } from "@/lib/experienceNetworkData";
import { PLACE_ROWS } from "@/components/network/FeedExplore";
import { ExploreListShell } from "@/components/network/ExploreCards";
import { FriendsMap } from "@/components/explore/FriendsMap";
import { cn } from "@/lib/utils";

export const metadata = { title: "Places" };

type Params = { circle?: string };

/** "See all" for the Explore tab's place rows: a map of where your friends (or everyone you follow) have been. */
export default async function NetworkPlacesPage({ searchParams }: { searchParams?: Params }) {
  const user = await getAuthUser();
  if (!user) redirect("/sign-in?next=/explore/places");

  const circle = searchParams?.circle === "network" ? "network" : "friends";
  const all = await loadCircleCountries(createClient(), user.id);

  return (
    <ExploreListShell title={PLACE_ROWS[circle].title} sub={PLACE_ROWS[circle].sub}>
      <nav aria-label="Whose places" className="mt-5 flex rounded-full border border-line bg-surface p-1">
        {(["friends", "network"] as const).map((c) => (
          <Link
            key={c}
            href={c === "network" ? "/explore/places?circle=network" : "/explore/places"}
            aria-current={c === circle ? "page" : undefined}
            className={cn(
              "flex flex-1 items-center justify-center rounded-full px-3 py-2 text-sm font-semibold transition-colors",
              c === circle ? "bg-accent text-white shadow-md shadow-accent/25" : "text-muted hover:text-ink"
            )}
          >
            {c === "friends" ? "Friends" : "Your network"}
          </Link>
        ))}
      </nav>
      <FriendsMap key={circle} countries={all[circle]} circle={circle} />
    </ExploreListShell>
  );
}

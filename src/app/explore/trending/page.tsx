import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { loadExplore } from "@/lib/exploreData";
import { ExploreListShell, TrendingCard } from "@/components/network/ExploreCards";

export const metadata = { title: "Trending memories" };

/** "See all" for the Explore tab's trending artists and events. */
export default async function ExploreTrendingPage() {
  const user = await getAuthUser();
  if (!user) redirect("/sign-in?next=/explore/trending");
  const { trending } = await loadExplore(createClient(), user.id, null, { trendingLimit: 48 });
  return (
    <ExploreListShell title="Trending memories" sub="The artists and events people are logging most.">
      {trending.length > 0 ? (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {trending.map((t) => (
            <li key={t.key}>
              <TrendingCard t={t} wide />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 text-center text-sm text-muted">Nothing trending yet.</p>
      )}
    </ExploreListShell>
  );
}

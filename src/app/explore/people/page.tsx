import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { loadNetworkHome } from "@/lib/experienceNetworkData";
import { ExploreListShell } from "@/components/network/ExploreCards";
import { PersonCardWide } from "@/components/network/FeedExplore";

export const metadata = { title: "People you may click with" };

/** "See all" for the Explore tab's people. */
export default async function ExplorePeoplePage() {
  const user = await getAuthUser();
  if (!user) redirect("/sign-in?next=/explore/people");
  const { people } = await loadNetworkHome(createClient(), user.id, { people: 40 });
  return (
    <ExploreListShell title="People you may click with" sub="Travellers whose places and events overlap yours.">
      {people.length > 0 ? (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {people.map((p) => (
            <PersonCardWide key={p.id} p={p} wide />
          ))}
        </ul>
      ) : (
        <p className="mt-10 text-center text-sm text-muted">No suggestions yet - they appear as more people add their trips and events.</p>
      )}
    </ExploreListShell>
  );
}

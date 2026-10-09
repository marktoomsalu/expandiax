import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { loadNetworkHome } from "@/lib/experienceNetworkData";
import { whereAmI } from "@/lib/location";
import { originFor } from "@/lib/flights";
import { PartnerNote } from "@/components/TripLinks";
import { ExploreListShell } from "@/components/network/ExploreCards";
import { IdeaCard, IdeaFlight } from "@/components/network/FeedExplore";

export const metadata = { title: "Ideas for your next trip" };

/** "See all" for the Explore tab's trip ideas. */
export default async function ExploreIdeasPage() {
  const user = await getAuthUser();
  if (!user) redirect("/sign-in?next=/explore/ideas");
  const supabase = createClient();
  const [{ ideas }, { data: me }] = await Promise.all([
    loadNetworkHome(supabase, user.id, { ideas: 60 }),
    supabase.from("profiles").select("home_country_code").eq("id", user.id).single(),
  ]);
  const home = me?.home_country_code ?? null;
  const origin = originFor(whereAmI(home)?.where ?? null, home);
  return (
    <ExploreListShell title="Ideas for your next trip" sub="Countries your network knows - and you don't, yet.">
      {ideas.length > 0 ? (
        <>
          <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
            {ideas.map((i) => (
              <IdeaCard key={i.country} i={i} wide flight={<IdeaFlight origin={origin} country={i.country} />} />
            ))}
          </ul>
          <PartnerNote className="mt-4" />
        </>
      ) : (
        <p className="mt-10 text-center text-sm text-muted">No ideas yet - they appear as people you follow add countries you haven&rsquo;t been to.</p>
      )}
    </ExploreListShell>
  );
}

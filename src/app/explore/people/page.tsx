import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { loadSuggestions } from "@/lib/suggestPeople";
import { ExploreListShell } from "@/components/network/ExploreCards";
import { SuggestedPeople } from "@/components/network/SuggestedPeople";

export const metadata = { title: "Suggested for you" };

/** "See all" for Suggested for you. */
export default async function ExplorePeoplePage() {
  const user = await getAuthUser();
  if (!user) redirect("/sign-in?next=/explore/people");
  const people = await loadSuggestions(createClient(), user.id, 48).catch(() => []);
  return (
    <ExploreListShell title="Suggested for you" sub="People you may know: who follows you, friends of your friends, and travellers whose places and events overlap yours.">
      <div className="mt-6">
        <SuggestedPeople people={people} title={null} seeAll={null} grid />
      </div>
    </ExploreListShell>
  );
}

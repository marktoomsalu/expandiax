import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { loadJourney } from "@/lib/journeyData";
import { hasRealName } from "@/lib/profileName";
import { JourneyPath } from "@/components/journey/JourneyPath";

export const metadata = { title: "Chapter One" };

export default async function JourneyPage() {
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");
  const supabase = createClient();
  const [journey, { data: profile }] = await Promise.all([
    loadJourney(supabase),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
  ]);
  if (!journey) redirect("/my-world");
  const first = hasRealName(profile?.display_name) ? profile.display_name.trim().split(/\s+/)[0] : null;
  return <JourneyPath journey={journey} name={first} />;
}

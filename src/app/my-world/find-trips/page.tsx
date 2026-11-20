import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { FindTrips } from "./FindTrips";

export const metadata = { title: "Find trips in my photos" };

/** "Find my world" for members: the trips in their photos that aren't on their map yet. */
export default async function FindTripsPage() {
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");
  const { data: profile } = await supabase.from("profiles").select("home_country_code").eq("id", user.id).single();
  return <FindTrips userId={user.id} homeCode={profile?.home_country_code ?? null} />;
}

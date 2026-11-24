import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { FindTrips } from "./FindTrips";

export const metadata = { title: "Discover my world" };

/** "Discover my world" (the automatic memory finder) for members: what their photos know that ExpandiaX doesn't yet. */
export default async function FindTripsPage() {
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");
  const [{ data: profile }, { data: countries }] = await Promise.all([
    supabase.from("profiles").select("home_country_code").eq("id", user.id).single(),
    supabase.from("visited_countries").select("country_code").eq("user_id", user.id).order("created_at", { ascending: false }).limit(40),
  ]);
  return (
    <FindTrips
      userId={user.id}
      homeCode={profile?.home_country_code ?? null}
      countryCodes={(countries ?? []).map((c) => c.country_code as string)}
    />
  );
}

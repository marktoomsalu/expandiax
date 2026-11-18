import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { LightUpMap } from "./LightUpMap";

export const metadata = { title: "Light up your map" };

/** "Where else have you been?": the first steps' country grid, for anyone already here. */
export default async function LightUpPage() {
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("home_country_code").eq("id", user.id).single(),
    supabase.from("visited_countries").select("country_code").eq("user_id", user.id),
  ]);
  const home = profile?.home_country_code ?? "";
  const have = (rows ?? []).map((r) => r.country_code as string).filter((c) => c !== home);

  return <LightUpMap userId={user.id} homeCode={home} have={have} />;
}

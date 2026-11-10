import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { TouchGlobes, type TouchMe } from "@/components/touch/TouchGlobes";
import type { GlobeCountry } from "@/lib/globeTouchLogic";

export const metadata = { title: "World Connect" };

// A sample person, for ?demo (previews and screenshots, signed out too).
const SAMPLE_ME: TouchMe = { id: "demo-me", username: "you", display_name: "You", avatar_url: null };
const SAMPLE_COUNTRIES = ["EE", "FI", "LV", "SE", "IT", "ES", "FR", "GR", "HR", "PT", "US", "TH", "JP", "DE", "NO"].map((code) => ({ code, lived: code === "FI" }));

export default async function TouchPage({ searchParams }: { searchParams: { demo?: string; cm?: string } }) {
  const demo = searchParams.demo === "reveal" ? "reveal" : searchParams.demo != null ? "approach" : null;
  const fixedCm = searchParams.cm ? Number(searchParams.cm) : null;
  const user = await getAuthUser();
  if (!user && !demo) redirect("/sign-in?next=/touch");

  if (!user) return <TouchGlobes me={SAMPLE_ME} myCountries={SAMPLE_COUNTRIES} demo={demo} fixedCm={fixedCm} />;

  const supabase = createClient();
  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name, avatar_url").eq("id", user.id).single(),
    supabase.from("visited_countries").select("country_code, country_visits(kind)").eq("user_id", user.id),
  ]);
  const myCountries: GlobeCountry[] = (rows ?? []).map((r) => ({
    code: r.country_code,
    lived: (r.country_visits ?? []).some((v: { kind: string | null }) => v.kind === "lived"),
  }));

  return <TouchGlobes me={(profile as TouchMe | null) ?? SAMPLE_ME} myCountries={myCountries} demo={demo} fixedCm={fixedCm} />;
}

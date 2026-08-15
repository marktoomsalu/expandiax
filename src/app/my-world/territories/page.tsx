import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { TerritoriesMap } from "@/components/TerritoriesMap";
import { TOTAL_TERRITORIES } from "@/lib/territories";
import type { Plan, VisitedTerritory } from "@/lib/types";

export const metadata = { title: "Territories" };

export default async function TerritoriesPage() {
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  const plan = (profile?.plan ?? "free") as Plan;

  if (plan !== "premium") {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <Lock size={28} className="mx-auto text-muted" aria-hidden />
        <h1 className="mt-4 text-3xl md:text-4xl">Territories is a Premium feature.</h1>
        <p className="mt-3 text-sm text-muted">
          Track Greenland, Gibraltar, Hong Kong, and other special territories alongside your world map — separate from your 195-country count.
        </p>
        <Link href="/settings/billing" className="btn-accent mt-6">Upgrade to Premium</Link>
        <div className="mt-6">
          <Link href="/my-world" className="text-sm text-muted hover:text-ink">Back to My World</Link>
        </div>
      </div>
    );
  }

  const { data } = await supabase.from("visited_territories").select("*").eq("user_id", user.id);
  const territories = (data ?? []) as VisitedTerritory[];
  const codes = territories.map((t) => t.territory_code);

  return (
    <div className="mx-auto max-w-shell px-5 py-10">
      <Link href="/my-world" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> My World
      </Link>

      <div className="mt-6">
        <p className="eyebrow">Territories</p>
        <h1 className="mt-1 text-3xl md:text-4xl">{codes.length} of {TOTAL_TERRITORIES} territories.</h1>
        <p className="mt-2 text-sm text-muted">
          Click a shape on the map, or a territory below, to mark it visited — click again to remove it. These don&rsquo;t count toward your 195 countries.
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-card border border-line bg-surface p-1.5 sm:p-3">
        <TerritoriesMap userId={user.id} visitedCodes={codes} />
      </div>
    </div>
  );
}

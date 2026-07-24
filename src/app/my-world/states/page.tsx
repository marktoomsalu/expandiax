import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { USStatesMap } from "@/components/USStatesMap";
import { TOTAL_US_STATES } from "@/lib/usStates";
import type { Plan, VisitedUSState } from "@/lib/types";

export const metadata = { title: "US States" };

export default async function USStatesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  const plan = (profile?.plan ?? "free") as Plan;

  if (plan !== "premium") {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <Lock size={28} className="mx-auto text-muted" aria-hidden />
        <h1 className="mt-4 text-3xl md:text-4xl">US States is a Premium feature.</h1>
        <p className="mt-3 text-sm text-muted">
          A separate map for the 50 states + DC, alongside your world map.
        </p>
        <Link href="/settings/billing" className="btn-accent mt-6">Upgrade to Premium</Link>
        <div className="mt-6">
          <Link href="/my-world" className="text-sm text-muted hover:text-ink">Back to My World</Link>
        </div>
      </div>
    );
  }

  const { data } = await supabase.from("visited_us_states").select("*").eq("user_id", user.id);
  const states = (data ?? []) as VisitedUSState[];
  const codes = states.map((s) => s.state_code);

  return (
    <div className="mx-auto max-w-shell px-5 py-10">
      <Link href="/my-world" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> My World
      </Link>

      <div className="mt-6">
        <p className="eyebrow">US States</p>
        <h1 className="mt-1 text-3xl md:text-4xl">{codes.length} of {TOTAL_US_STATES} states.</h1>
        <p className="mt-2 text-sm text-muted">Click a state to mark it visited — click again to remove it.</p>
      </div>

      <div className="mt-8 overflow-hidden rounded-card border border-line bg-surface p-1.5 sm:p-3">
        <USStatesMap userId={user.id} visitedCodes={codes} />
      </div>

      {states.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl">Your states</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {[...states]
              .sort((a, b) => a.state_name.localeCompare(b.state_name))
              .map((s) => (
                <li key={s.id} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm">
                  {s.state_name}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}

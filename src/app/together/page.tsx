import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { loadTogether } from "@/lib/togetherData";
import type { Shared } from "@/lib/together";
import { EmptyState } from "@/components/EmptyState";
import { AvatarPair, SharedCard } from "@/components/TogetherCards";
import { TogetherPrompts } from "@/components/TogetherPrompts";

export const metadata = { title: "Together" };

// Every moment you share with people you follow — the same concert, race or
// festival, or being in the same country at the same time — person by person,
// with both memories side by side.
export default async function TogetherPage() {
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");
  const supabase = createClient();

  const [{ data: me }, { data: follows }] = await Promise.all([
    supabase.from("profiles").select("username, display_name, avatar_url, home_country_code").eq("id", user.id).single(),
    supabase.from("follows").select("followee_id").eq("follower_id", user.id),
  ]);
  if (!me) redirect("/onboarding");
  const followeeIds = (follows ?? []).map((f) => f.followee_id);
  const data = await loadTogether(supabase, user.id, followeeIds, me.home_country_code ?? null);

  // One group per person, the person you shared something with most recently first.
  const byPerson = new Map<string, Shared[]>();
  for (const s of data.shared) {
    if (!data.people[s.personId]) continue;
    byPerson.set(s.personId, [...(byPerson.get(s.personId) ?? []), s]);
  }
  const hasPrompts = data.prompts.some((p) => data.people[p.personId]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/feed" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Feed
      </Link>
      <h1 className="mt-4 flex items-center gap-2 text-4xl">
        <Users size={28} className="text-accent" aria-hidden /> Together
      </h1>
      <p className="mt-2 text-sm text-muted">
        The concerts, races and trips you shared with people you follow - found from what you&rsquo;ve both logged.
      </p>

      {byPerson.size === 0 && !hasPrompts && (
        <div className="mt-8">
          <EmptyState
            title="Nothing shared yet."
            body="When you and someone you follow log the same concert, festival or race, or were in the same country at the same time, it shows up here."
            actionLabel={followeeIds.length ? "Log an event" : "Find people to follow"}
            actionHref={followeeIds.length ? "/events/new" : "/explore"}
          />
        </div>
      )}

      {[...byPerson.entries()].map(([personId, items]) => {
        const person = data.people[personId];
        return (
          <section key={personId} id={`with-${person.username}`} className="mt-10 scroll-mt-24" aria-labelledby={`with-${person.username}-h`}>
            <div className="flex items-center gap-3">
              <AvatarPair me={me} person={person} size={36} />
              <div className="min-w-0">
                <h2 id={`with-${person.username}-h`} className="truncate text-xl">
                  You &amp; <Link href={`/u/${person.username}`} className="hover:text-accent">{person.display_name}</Link>
                </h2>
                <p className="text-xs text-muted">
                  {items.length} {items.length === 1 ? "moment" : "moments"} together
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-3">
              {items.map((s) => (
                <li key={s.kind === "event" ? s.theirs.id : `${s.countryCode}-${s.from}`}>
                  <SharedCard item={s} person={person} me={me} covers={data.covers} variant="page" />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {hasPrompts && (
        <section className="mt-12 border-t border-line pt-8" aria-labelledby="maybe-h">
          <h2 id="maybe-h" className="text-xl">Were you there too?</h2>
          <p className="mt-1 text-sm text-muted">Events people you follow went to, where you might have been as well.</p>
          <div className="mt-4">
            <TogetherPrompts prompts={data.prompts} people={data.people} limit={20} />
          </div>
        </section>
      )}
    </div>
  );
}

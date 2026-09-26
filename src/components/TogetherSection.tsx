import Link from "next/link";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadTogether } from "@/lib/togetherData";
import { SharedCard, type Me } from "./TogetherCards";
import { TogetherPrompts } from "./TogetherPrompts";

/** Feed: the latest moments you shared with people you follow, then a couple of plausible "were you there too?". */
export async function TogetherSection({ userId, followeeIds, homeCountry, me }: { userId: string; followeeIds: string[]; homeCountry: string | null; me: Me }) {
  const data = await loadTogether(createClient(), userId, followeeIds, homeCountry).catch(() => null);
  if (!data) return null;
  const shared = data.shared.filter((s) => data.people[s.personId]);
  if (shared.length === 0 && data.prompts.length === 0) return null;
  const more = shared.length > 3 || data.prompts.length > 2;

  return (
    <section className="mt-10" aria-labelledby="together-h">
      <div className="flex items-center justify-between">
        <h2 id="together-h" className="flex items-center gap-1.5 text-sm font-medium text-muted">
          <Users size={14} aria-hidden /> Together
        </h2>
        {more && (
          <Link href="/together" className="text-xs text-accent hover:underline">
            See all
          </Link>
        )}
      </div>
      {shared.length > 0 && (
        <ul className="mt-4 space-y-3">
          {shared.slice(0, 3).map((s) => (
            <li key={s.kind === "event" ? s.theirs.id : `${s.personId}-${s.countryCode}-${s.from}`}>
              <SharedCard item={s} person={data.people[s.personId]} me={me} covers={data.covers} variant="feed" />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <TogetherPrompts prompts={data.prompts} people={data.people} limit={2} />
      </div>
    </section>
  );
}

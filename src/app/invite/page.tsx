import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { Check } from "lucide-react";
import { BADGES } from "@/lib/badges";
import { InviteShare } from "@/components/invite/InviteShare";

// The Friends badges, in order: Connector 5, Ambassador 10, Trailblazer 25.
const LEVELS = BADGES.filter((b) => b.group === "friends");

export const metadata = { title: "Invite friends" };

/** Your invite link, who joined through it, and the way to the Connector badge. */
export default async function InvitePage() {
  const user = await getAuthUser();
  if (!user) redirect("/sign-in?next=/invite");
  const supabase = createClient();
  const [{ data: me }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("username, display_name").eq("id", user.id).single(),
    supabase.from("invites").select("invitee_id, created_at").eq("inviter_id", user.id).order("created_at", { ascending: false }),
  ]);
  const ids = (rows ?? []).map((r) => r.invitee_id as string);
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", ids) : { data: [] };
  const byId = new Map((people ?? []).map((p) => [p.id as string, p]));
  const joined = ids.map((id) => byId.get(id)).filter(Boolean) as { id: string; username: string; display_name: string; avatar_url: string | null }[];
  const n = joined.length;
  const next = LEVELS.find((l) => n < l.target) ?? null;
  const left = next ? next.target - n : 0;

  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-8">
      <div className="overflow-hidden rounded-[28px] px-6 pb-6 pt-8 text-center text-white" style={{ background: "radial-gradient(120% 90% at 50% 0%, #4a1450 0%, #2b0b2e 55%, #12041a 100%)" }}>
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-travel shadow-lg" aria-hidden>
          <Users size={26} />
        </span>
        <h1 className="mt-4 font-serif text-3xl leading-tight">Worlds are better shared</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-white/75">
          Invite your friends to ExpandiaX! You&rsquo;ll automatically follow each other, and their memories will appear in your feed.
        </p>

        {/* The first five: a stamp for each friend who joins. Past five, a bar to the next level. */}
        {n < 5 ? (
        <div className="mt-6 flex justify-center gap-2" aria-label={`${n} of 5 friends joined`}>
          {Array.from({ length: 5 }, (_, i) => {
            const p = joined[i];
            return (
              <span
                key={i}
                className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full font-serif text-lg ${p ? "ring-2 ring-[#fa51a2]" : "border-2 border-dashed border-white/25 text-white/30"}`}
              >
                {p ? p.avatar_url ? <Image src={p.avatar_url} alt="" fill sizes="48px" className="object-cover" /> : <span className="flex h-full w-full items-center justify-center bg-white/15">{p.display_name.charAt(0)}</span> : i + 1}
              </span>
            );
          })}
        </div>
        ) : (
          <div className="mx-auto mt-6 max-w-xs">
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div className="gradient-travel h-full rounded-full" style={{ width: `${next ? (n / next.target) * 100 : 100}%` }} />
            </div>
          </div>
        )}
        <p className="mt-3 text-sm font-medium">
          {next ? `${n}/${next.target} friends joined · ${left} more for ${next.label}` : `${n} friends joined · every Friends badge is yours`}
        </p>

        {/* The three levels. */}
        <ul className="mt-5 grid grid-cols-3 gap-2">
          {LEVELS.map((l) => {
            const got = n >= l.target;
            return (
              <li key={l.id} className={`rounded-2xl px-2 py-3 ${got ? "bg-white/15 ring-1 ring-[#fa51a2]" : "bg-white/5"}`}>
                <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full ${got ? "gradient-travel text-white" : "bg-white/10 text-white/50"}`} aria-hidden>
                  {got ? <Check size={16} /> : <l.icon size={16} />}
                </span>
                <span className={`mt-1.5 block text-xs font-semibold ${got ? "" : "text-white/70"}`}>{l.label}</span>
                <span className="block text-[11px] text-white/50">{l.target} friends</span>
              </li>
            );
          })}
        </ul>

        <div className="mt-6">
          <InviteShare username={me?.username ?? ""} dark />
        </div>
      </div>


      {joined.length > 0 && (
        <section className="mt-8" aria-labelledby="joined-h">
          <h2 id="joined-h" className="font-serif text-xl">Joined with your link</h2>
          <ul className="mt-3 divide-y divide-line">
            {joined.map((p) => (
              <li key={p.id}>
                <Link href={`/u/${p.username}`} className="flex items-center gap-3 py-2.5">
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-serif text-accent">
                    {p.avatar_url ? <Image src={p.avatar_url} alt="" fill sizes="40px" className="object-cover" /> : p.display_name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.display_name}</span>
                    <span className="block truncate text-xs text-muted">@{p.username}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-8 text-center text-xs text-muted">
        Only friends who create a new ExpandiaX account through your invite link (or enter your username when they sign up) count towards your invitation badges. Your link never expires.
      </p>
    </div>
  );
}

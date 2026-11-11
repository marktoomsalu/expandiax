import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { CONNECTOR_TARGET } from "@/lib/invite";
import { InviteShare } from "@/components/invite/InviteShare";
import { ConnectorBadge } from "@/components/invite/ConnectorBadge";

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
  const left = Math.max(0, CONNECTOR_TARGET - n);

  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-8">
      <div className="overflow-hidden rounded-[28px] px-6 pb-6 pt-8 text-center text-white" style={{ background: "radial-gradient(120% 90% at 50% 0%, #4a1450 0%, #2b0b2e 55%, #12041a 100%)" }}>
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-travel shadow-lg" aria-hidden>
          <Users size={26} />
        </span>
        <h1 className="mt-4 font-serif text-3xl leading-tight">Invite your friends</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-white/75">
          When a friend joins through your link, you follow each other straight away, and their trips land in your feed.
        </p>

        {/* Five stamps: one for each friend who joins. */}
        <div className="mt-6 flex justify-center gap-2" aria-label={`${Math.min(n, CONNECTOR_TARGET)} of ${CONNECTOR_TARGET} friends joined`}>
          {Array.from({ length: CONNECTOR_TARGET }, (_, i) => {
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
        <p className="mt-3 text-sm font-medium">
          {left > 0 ? `${n} of ${CONNECTOR_TARGET} friends joined · ${left} more for the Connector badge` : `${n} friends joined · you're a Connector`}
        </p>

        <div className="mt-6">
          <InviteShare username={me?.username ?? ""} dark />
        </div>
      </div>

      {n >= CONNECTOR_TARGET && <ConnectorBadge count={n} className="mt-6" />}

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
      <p className="mt-8 text-center text-xs text-muted">Only friends who make their own account count. Your link never expires.</p>
    </div>
  );
}

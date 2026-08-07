import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Heart, MessageCircle, UserPlus } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { countryByCode } from "@/lib/countries";
import { formatRelative } from "@/lib/utils";
import type { NotificationWithActor } from "@/lib/types";

export const metadata = { title: "Notifications" };

const ICONS = { like: Heart, comment: MessageCircle, follow: UserPlus };

export default async function NotificationsPage() {
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  if (!profile) redirect("/sign-in");
  const username = profile.username;

  const { data: rows } = await supabase
    .from("notifications")
    .select("*, actor:profiles!notifications_actor_id_fkey(username, display_name, avatar_url)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const notifications = (rows ?? []) as NotificationWithActor[];

  const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
  if (unreadIds.length > 0) {
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
  }

  const countryIds = notifications.filter((n) => n.target_kind === "country" && n.target_id).map((n) => n.target_id!);
  const eventIds = notifications.filter((n) => n.target_kind === "event" && n.target_id).map((n) => n.target_id!);
  const [{ data: countryRows }, { data: eventRows }] = await Promise.all([
    countryIds.length
      ? supabase.from("visited_countries").select("id, country_code, country_name").in("id", countryIds)
      : Promise.resolve({ data: [] as { id: string; country_code: string; country_name: string }[] }),
    eventIds.length
      ? supabase.from("events").select("id, title").in("id", eventIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);
  const countryById = new Map((countryRows ?? []).map((r) => [r.id, r]));
  const eventById = new Map((eventRows ?? []).map((r) => [r.id, r]));

  function target(n: NotificationWithActor): { label: string; href: string } | null {
    if (n.target_kind === "country" && n.target_id) {
      const c = countryById.get(n.target_id);
      if (!c) return null;
      const meta = countryByCode(c.country_code);
      return { label: `${meta?.flag ?? ""} ${c.country_name}`, href: `/u/${username}/countries/${c.country_code.toLowerCase()}` };
    }
    if (n.target_kind === "event" && n.target_id) {
      const e = eventById.get(n.target_id);
      if (!e) return null;
      return { label: e.title, href: `/u/${username}/events/${n.target_id}` };
    }
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <p className="eyebrow">Notifications</p>
      <h1 className="mt-2 text-3xl md:text-4xl">What&rsquo;s happened lately.</h1>

      {notifications.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Quiet for now."
            body="Likes, comments and new followers will show up here."
          />
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-line">
          {notifications.map((n) => {
            const Icon = ICONS[n.kind];
            const t = target(n);
            const actor = n.actor;
            const actorHref = actor ? `/u/${actor.username}` : "#";
            const actorName = actor?.display_name ?? "Someone";

            let text: React.ReactNode;
            if (n.kind === "follow") {
              text = <>started following you</>;
            } else if (n.kind === "like") {
              text = t ? (
                <>
                  liked your {n.target_kind === "country" ? "trip to" : "event"}{" "}
                  <Link href={t.href} className="font-medium text-ink hover:text-accent">{t.label}</Link>
                </>
              ) : (
                <>liked something you posted</>
              );
            } else {
              text = t ? (
                <>
                  commented on{" "}
                  <Link href={t.href} className="font-medium text-ink hover:text-accent">{t.label}</Link>
                  {n.comment_body && <span className="block italic text-muted">&ldquo;{n.comment_body}&rdquo;</span>}
                </>
              ) : (
                <>commented: &ldquo;{n.comment_body}&rdquo;</>
              );
            }

            return (
              <li key={n.id} className={`flex items-start gap-3 py-4 ${!n.read ? "bg-accent-soft/40" : ""}`}>
                <div className="relative shrink-0">
                  <Link
                    href={actorHref}
                    aria-label={actorName}
                    className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-line bg-raised font-serif text-sm text-muted"
                  >
                    {actor?.avatar_url ? (
                      <Image src={actor.avatar_url} alt="" width={40} height={40} className="h-full w-full object-cover" />
                    ) : (
                      actorName.charAt(0)
                    )}
                  </Link>
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-canvas bg-surface text-accent">
                    <Icon size={11} className={n.kind === "like" ? "fill-accent" : undefined} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed">
                    <Link href={actorHref} className="font-medium hover:text-accent">{actorName}</Link>{" "}
                    {text}
                  </p>
                  <p className="mt-1 text-xs text-muted">{formatRelative(n.created_at)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

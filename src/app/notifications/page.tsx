import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Clock, Heart, HelpCircle, MessageCircle, MessagesSquare, UserCheck, UserPlus } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { FollowRequestActions } from "@/components/FollowRequestActions";
import { FollowButton } from "@/components/FollowButton";
import { countryByCode } from "@/lib/countries";
import { formatRelative } from "@/lib/utils";
import type { NotificationWithActor, ProfileVisibility } from "@/lib/types";

export const metadata = { title: "Notifications" };

const ICONS = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  follow_request: Clock,
  follow_accepted: UserCheck,
  question: HelpCircle,
  answer: MessagesSquare,
};

export default async function NotificationsPage() {
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  if (!profile) redirect("/sign-in");
  const username = profile.username;

  const { data: rows } = await supabase
    .from("notifications")
    .select("*, actor:profiles!notifications_actor_id_fkey(username, display_name, avatar_url, visibility)")
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
  const questionIds = notifications.filter((n) => n.target_kind === "question" && n.target_id).map((n) => n.target_id!);
  const [{ data: countryRows }, { data: eventRows }, { data: questionRows }] = await Promise.all([
    countryIds.length
      ? supabase.from("visited_countries").select("id, country_code, country_name").in("id", countryIds)
      : Promise.resolve({ data: [] as { id: string; country_code: string; country_name: string }[] }),
    eventIds.length
      ? supabase.from("events").select("id, title").in("id", eventIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    questionIds.length
      ? supabase.from("place_questions").select("id, country_code").in("id", questionIds)
      : Promise.resolve({ data: [] as { id: string; country_code: string }[] }),
  ]);
  const questionById = new Map((questionRows ?? []).map((r) => [r.id, r]));
  const countryById = new Map((countryRows ?? []).map((r) => [r.id, r]));
  const eventById = new Map((eventRows ?? []).map((r) => [r.id, r]));

  // A follow_request notification stays forever, but the request itself
  // gets deleted the moment it's accepted or declined — only show the
  // Accept/Decline buttons for ones that are still actually pending.
  const { data: pendingRequests } = await supabase.from("follow_requests").select("requester_id").eq("target_id", user.id);
  const pendingRequesterIds = new Set((pendingRequests ?? []).map((r) => r.requester_id));

  // "Follow back" for people who follow you now and you don't follow yet -
  // on their newest notification only.
  const followerIds = [...new Set(notifications.filter((n) => n.kind === "follow" || n.kind === "follow_request").map((n) => n.actor_id))];
  const [{ data: theirs }, { data: mine }, { data: asked }] = followerIds.length
    ? await Promise.all([
        supabase.from("follows").select("follower_id").eq("followee_id", user.id).in("follower_id", followerIds),
        supabase.from("follows").select("followee_id").eq("follower_id", user.id).in("followee_id", followerIds),
        supabase.from("follow_requests").select("target_id").eq("requester_id", user.id).in("target_id", followerIds),
      ])
    : [{ data: [] as { follower_id: string }[] }, { data: [] as { followee_id: string }[] }, { data: [] as { target_id: string }[] }];
  const followsMe = new Set((theirs ?? []).map((r) => r.follower_id));
  const iFollow = new Set((mine ?? []).map((r) => r.followee_id));
  const iAsked = new Set((asked ?? []).map((r) => r.target_id));
  const offerBack = new Set<string>();
  const backOn = new Set<string>();
  for (const n of notifications) {
    if ((n.kind === "follow" || n.kind === "follow_request") && followsMe.has(n.actor_id) && !iFollow.has(n.actor_id) && !backOn.has(n.actor_id)) {
      backOn.add(n.actor_id);
      offerBack.add(n.id);
    }
  }

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
    if (n.target_kind === "question" && n.target_id) {
      const q = questionById.get(n.target_id);
      const meta = q ? countryByCode(q.country_code) : null;
      if (!meta) return null;
      return { label: `${meta.flag} ${meta.name}`, href: `/explore/country/${meta.code.toLowerCase()}#q-${n.target_id}` };
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
            // Where tapping the notification takes you: the post (straight to
            // its comments for a comment), the question, or the person.
            const rowHref =
              n.kind === "comment" && n.target_kind === "event" && t ? `${t.href}#comments` : t ? t.href : n.kind.startsWith("follow") && actor ? actorHref : null;

            let text: React.ReactNode;
            if (n.kind === "follow") {
              text = <>started following you</>;
            } else if (n.kind === "follow_request") {
              text = <>wants to follow you</>;
            } else if (n.kind === "follow_accepted") {
              text = <>accepted your follow request</>;
            } else if (n.kind === "question" || n.kind === "answer") {
              text = (
                <>
                  {n.kind === "question" ? "asks about" : "answered your question about"}{" "}
                  {t ? <Link href={t.href} className="font-medium text-ink hover:text-accent">{t.label}</Link> : "a place"}
                  {n.comment_body && <span className="block italic text-muted">&ldquo;{n.comment_body}&rdquo;</span>}
                </>
              );
            } else if (n.kind === "like") {
              text = t ? (
                <>
                  remembered your {n.target_kind === "country" ? "trip to" : "event"}{" "}
                  <Link href={t.href} className="font-medium text-ink hover:text-accent">{t.label}</Link>
                </>
              ) : (
                <>remembered something you posted</>
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
              <li key={n.id} className={`relative flex items-start gap-3 py-4 ${!n.read ? "bg-accent-soft/40" : ""}`}>
                {/* The whole row opens it; the name, photo and buttons above it keep their own taps. */}
                {rowHref && <Link href={rowHref} aria-label={`Open: ${actorName}`} className="absolute inset-0 z-0" />}
                <div className="relative z-10 shrink-0">
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
                <div className="pointer-events-none min-w-0 flex-1 [&_a]:pointer-events-auto [&_a]:relative [&_a]:z-10 [&_button]:pointer-events-auto [&_button]:relative [&_button]:z-10">
                  <p className="text-sm leading-relaxed">
                    <Link href={actorHref} className="font-medium hover:text-accent">{actorName}</Link>{" "}
                    {text}
                  </p>
                  <p className="mt-1 text-xs text-muted">{formatRelative(n.created_at)}</p>
                  {n.kind === "follow_request" && pendingRequesterIds.has(n.actor_id) && (
                    <FollowRequestActions requesterId={n.actor_id} />
                  )}
                  {offerBack.has(n.id) && (
                    <div className="mt-2">
                      <FollowButton
                        targetId={n.actor_id}
                        visibility={((actor as { visibility?: ProfileVisibility } | null)?.visibility ?? "public")}
                        initialFollowing={false}
                        initialRequested={iAsked.has(n.actor_id)}
                        back
                        compact
                        refresh={false}
                      />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

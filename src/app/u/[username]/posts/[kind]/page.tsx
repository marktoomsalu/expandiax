import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { loadPostContext, loadUserPosts } from "@/lib/feedPosts";
import { FeedPost } from "@/components/FeedPost";
import { LoadMore } from "@/components/LoadMore";
import { tripAsPost, tripsOf } from "@/lib/userTrips";
import { signMedia } from "@/lib/signedMedia";

type Props = { params: { username: string; kind: string }; searchParams?: { limit?: string } };

const KINDS = { trips: { kind: "country", title: "Trips" }, events: { kind: "event", title: "Events" } } as const;
const PAGE = 10;

export function generateMetadata({ params }: Props) {
  return { title: KINDS[params.kind as keyof typeof KINDS]?.title ?? "Posts" };
}

/** "See more" from a profile: all of someone's trip (or event) posts, as in the feed. */
export default async function UserPostsPage({ params, searchParams }: Props) {
  const which = KINDS[params.kind as keyof typeof KINDS];
  if (!which) notFound();
  const supabase = createClient();
  const { data: profile } = await supabase.from("profiles").select("id, username, display_name").eq("username", params.username.toLowerCase()).maybeSingle();
  if (!profile) notFound();
  const limit = Math.min(Math.max(Number(searchParams?.limit) || PAGE, PAGE), 200);
  // Trips one by one, newest by when they happened; events newest posted first.
  const [user, fetched, countries] = await Promise.all([
    getAuthUser(),
    which.kind === "event" ? loadUserPosts(supabase, profile.id, { kind: "event", limit: limit + 1 }) : Promise.resolve([]),
    which.kind === "country"
      ? signMedia(await supabase.from("visited_countries").select("*, country_media!country_media_visited_country_id_fkey(*), country_visits(*)").eq("user_id", profile.id)).then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);
  const trips = which.kind === "country" ? tripsOf(countries as Parameters<typeof tripsOf>[0]).map((t) => ({ key: t.visit.id, ...tripAsPost(t) })) : [];
  const all = which.kind === "country" ? trips.map((t) => t.item) : fetched;
  const posts = all.slice(0, limit);
  const ctx = await loadPostContext(supabase, user?.id ?? null, posts);
  const mine = user?.id === profile.id;

  return (
    <div className="mx-auto max-w-2xl px-5 py-6">
      <Link href={`/u/${profile.username}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> {mine ? "Your profile" : profile.display_name}
      </Link>
      <h1 className="mt-3 text-3xl">{mine ? `Your ${which.title.toLowerCase()}` : `${profile.display_name.split(" ")[0]}’s ${which.title.toLowerCase()}`}</h1>
      {posts.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">Nothing shared yet.</p>
      ) : (
        <>
          <ul className="mt-6 space-y-8">
            {which.kind === "country"
              ? trips.slice(0, limit).map((t, i) => <FeedPost key={t.key} item={t.item} ctx={ctx} index={i} media={t.media} dateLabel={t.dateLabel} actionLabel={t.actionLabel} hideWhen href={`/u/${profile.username}/trips/${t.key}`} />)
              : posts.map((p, i) => <FeedPost key={`${p.kind}:${p.ref_id}`} item={p} ctx={ctx} index={i} />)}
          </ul>
          <LoadMore href={`/u/${profile.username}/posts/${params.kind}?limit=${limit + PAGE}`} shown={limit} more={all.length > limit} />
        </>
      )}
    </div>
  );
}

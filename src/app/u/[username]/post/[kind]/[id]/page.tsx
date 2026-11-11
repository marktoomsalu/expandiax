import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { loadPost, loadPostContext } from "@/lib/feedPosts";
import { FeedPost } from "@/components/FeedPost";

type Props = { params: { username: string; kind: string; id: string } };

const KINDS = { trip: "country", event: "event" } as const;

export async function generateMetadata({ params }: Props) {
  const kind = KINDS[params.kind as keyof typeof KINDS];
  if (!kind) return {};
  const post = await loadPost(createClient(), kind, params.id);
  return { title: post ? post.title : "Post" };
}

/**
 * One trip or event post, the same as in the feed: photos, words, likes and
 * comments. Its owner gets the way to change it (My World for a trip).
 */
export default async function PostPage({ params }: Props) {
  const kind = KINDS[params.kind as keyof typeof KINDS];
  if (!kind || !/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const supabase = createClient();
  const [user, post] = await Promise.all([getAuthUser(), loadPost(supabase, kind, params.id)]);
  if (!post) notFound();
  const ctx = await loadPostContext(supabase, user?.id ?? null, [post]);
  const actor = ctx.actors.get(post.actor_id);
  if (!actor || actor.username !== params.username.toLowerCase()) notFound();
  const mine = user?.id === post.actor_id;

  return (
    <div className="mx-auto max-w-2xl px-5 py-6">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/u/${actor.username}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} aria-hidden /> {mine ? "Your profile" : actor.display_name}
        </Link>
        {mine && (
          <Link
            href={kind === "country" ? `/my-world/${post.country_code.toLowerCase()}` : `/events/${post.ref_id}/edit`}
            className="btn-ghost !gap-1.5 !px-3.5 !py-2 text-sm"
          >
            <Pencil size={14} aria-hidden /> {kind === "country" ? "Edit in My World" : "Edit event"}
          </Link>
        )}
      </div>
      <ul className="mt-4">
        <FeedPost item={post} ctx={ctx} />
      </ul>
    </div>
  );
}

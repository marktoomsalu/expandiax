"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelative } from "@/lib/utils";
import type { CommentWithAuthor } from "@/lib/types";

type Props = {
  kind: "country" | "event";
  targetId: string;
  posterId: string;
  initialComments: CommentWithAuthor[];
};

export function CommentSection({ kind, targetId, posterId, initialComments }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [comments, setComments] = useState(initialComments);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy || !currentUserId) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("comments")
      .insert({ user_id: currentUserId, kind, target_id: targetId, body })
      .select("*, profiles(username, display_name, avatar_url)")
      .single();
    if (!error && data) {
      setComments((c) => [...c, data as CommentWithAuthor]);
      setText("");
      router.refresh();
    }
    setBusy(false);
  }

  async function remove(id: string) {
    setDeletingId(id);
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (!error) {
      setComments((c) => c.filter((x) => x.id !== id));
      router.refresh();
    }
    setDeletingId(null);
  }

  return (
    <div className="space-y-4">
      {comments.length > 0 && (
        <ul className="space-y-3">
          {comments.map((c) => {
            const author = c.profiles;
            const canDelete = currentUserId === c.user_id || currentUserId === posterId;
            return (
              <li key={c.id} className="flex items-start gap-2.5">
                <Link
                  href={author ? `/u/${author.username}` : "#"}
                  aria-label={author?.display_name}
                  className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-raised font-serif text-xs text-muted"
                >
                  {author?.avatar_url ? (
                    <Image src={author.avatar_url} alt="" width={32} height={32} className="h-full w-full object-cover" />
                  ) : (
                    author?.display_name.charAt(0) ?? "?"
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <Link href={author ? `/u/${author.username}` : "#"} className="font-medium hover:text-accent">
                      {author?.display_name ?? "Someone"}
                    </Link>{" "}
                    <span className="break-words text-ink">{c.body}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{formatRelative(c.created_at)}</p>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    aria-label="Delete comment"
                    onClick={() => remove(c.id)}
                    disabled={deletingId === c.id}
                    className="shrink-0 text-muted hover:text-red-800 dark:hover:text-red-400"
                  >
                    <X size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {currentUserId ? (
        <form onSubmit={submit} className="flex items-center gap-2">
          <MessageCircle size={16} className="shrink-0 text-muted" aria-hidden />
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            maxLength={500}
            className="min-w-0 flex-1 border-b border-line bg-transparent py-1 text-sm outline-none focus:border-accent"
          />
          <button type="submit" disabled={busy || !text.trim()} className="text-sm font-medium text-accent disabled:opacity-40">
            Post
          </button>
        </form>
      ) : (
        comments.length === 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <MessageCircle size={14} aria-hidden /> No comments yet.
          </p>
        )
      )}
    </div>
  );
}

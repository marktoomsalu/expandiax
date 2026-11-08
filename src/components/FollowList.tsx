import Link from "next/link";
import Image from "next/image";
import { RemoveFollowerButton } from "./RemoveFollowerButton";
import { FollowButton } from "./FollowButton";
import type { ProfileVisibility } from "@/lib/types";

type ListedProfile = { id: string; username: string; display_name: string; avatar_url: string | null };
/** For your own followers: whether you follow each one back. */
export type FollowBack = Record<string, { visibility: ProfileVisibility; following: boolean; requested: boolean }>;

function Person({ p }: { p: ListedProfile }) {
  return (
    <>
      {p.avatar_url ? (
        <Image src={p.avatar_url} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full border border-line object-cover" />
      ) : (
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-raised font-serif text-lg text-muted">
          {p.display_name.charAt(0)}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate font-serif text-lg group-hover:text-accent">{p.display_name}</p>
        <p className="truncate text-xs text-muted">@{p.username}</p>
      </div>
    </>
  );
}

/**
 * `removable`: it's your own followers list - each person can be removed,
 * and anyone you don't follow yet gets "Follow back".
 */
export function FollowList({
  profiles,
  emptyMessage,
  removable = false,
  followBack,
}: {
  profiles: ListedProfile[];
  emptyMessage: string;
  removable?: boolean;
  followBack?: FollowBack;
}) {
  if (profiles.length === 0) {
    return <p className="mt-8 text-sm text-muted">{emptyMessage}</p>;
  }
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
      {profiles.map((p) => {
        if (!removable) {
          return (
            <li key={p.id}>
              <Link href={`/u/${p.username}`} className="card group flex items-center gap-4 px-4 py-3.5">
                <Person p={p} />
              </Link>
            </li>
          );
        }
        const back = followBack?.[p.id];
        return (
          <li key={p.id} className="card px-4 py-3.5">
            <Link href={`/u/${p.username}`} className="group flex items-center gap-4">
              <Person p={p} />
            </Link>
            <div className="mt-3 flex items-center gap-2 pl-[3.75rem]">
              {back && !back.following && (
                <FollowButton targetId={p.id} visibility={back.visibility} initialFollowing={false} initialRequested={back.requested} back compact refresh={false} />
              )}
              <RemoveFollowerButton followerId={p.id} name={p.display_name} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

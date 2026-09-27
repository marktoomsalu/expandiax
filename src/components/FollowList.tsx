import Link from "next/link";
import Image from "next/image";
import { RemoveFollowerButton } from "./RemoveFollowerButton";

type ListedProfile = { id: string; username: string; display_name: string; avatar_url: string | null };

/** `removable`: it's your own followers list — each person can be removed. */
export function FollowList({ profiles, emptyMessage, removable = false }: { profiles: ListedProfile[]; emptyMessage: string; removable?: boolean }) {
  if (profiles.length === 0) {
    return <p className="mt-8 text-sm text-muted">{emptyMessage}</p>;
  }
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
      {profiles.map((p) => (
        <li key={p.id} className="relative">
          <Link href={`/u/${p.username}`} className={`card group flex items-center gap-4 px-4 py-3.5 ${removable ? "pr-28" : ""}`}>
            {p.avatar_url ? (
              <Image src={p.avatar_url} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full border border-line object-cover" />
            ) : (
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-raised font-serif text-lg text-muted">
                {p.display_name.charAt(0)}
              </span>
            )}
            <div className="min-w-0">
              <p className="font-serif text-lg group-hover:text-accent">{p.display_name}</p>
              <p className="truncate text-xs text-muted">@{p.username}</p>
            </div>
          </Link>
          {removable && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2">
              <RemoveFollowerButton followerId={p.id} name={p.display_name} />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

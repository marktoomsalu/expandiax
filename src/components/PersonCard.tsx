import Image from "next/image";
import Link from "next/link";
import { Lock } from "lucide-react";
import type { ProfileVisibility } from "@/lib/types";

type Person = { username: string; display_name: string; avatar_url: string | null; visibility?: ProfileVisibility };

export function PersonAvatar({ p, size = 48 }: { p: { display_name: string; avatar_url: string | null }; size?: number }) {
  return p.avatar_url ? (
    <Image src={p.avatar_url} alt="" width={size} height={size} className="shrink-0 rounded-full border border-line object-cover" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full border border-line bg-raised font-serif text-lg text-muted" style={{ width: size, height: size }}>
      {p.display_name.charAt(0)}
    </span>
  );
}

/** A person in search results or lists: photo, name, a line about them. */
export function PersonCard({ p, detail }: { p: Person; detail: string }) {
  return (
    <Link href={`/u/${p.username}`} className="card group flex items-center gap-4 px-4 py-4">
      <PersonAvatar p={p} />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-serif text-lg group-hover:text-accent">
          {p.display_name}
          {p.visibility && p.visibility !== "public" && <Lock size={13} className="shrink-0 text-muted" aria-label="Private account" />}
        </p>
        <p className="truncate text-xs text-muted">{detail}</p>
      </div>
    </Link>
  );
}

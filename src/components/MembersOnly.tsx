import Link from "next/link";
import { Lock } from "lucide-react";

const FACES = ["#7c5cff", "#0ea5e9", "#f59e0b", "#10b981", "#ef4444"];

/** Where a member list would be, for visitors: blurred made-up faces, the count, and a way in. */
export function MembersOnly({ count, next }: { count: number; next: string }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <span className="flex" aria-hidden>
        {FACES.slice(0, Math.min(5, Math.max(1, count))).map((c, i) => (
          <span key={c} className="h-7 w-7 rounded-full border-2 border-surface blur-[2px]" style={{ background: c, marginLeft: i ? -10 : 0 }} />
        ))}
      </span>
      <span className="text-sm text-muted">
        {count} {count === 1 ? "member" : "members"}
      </span>
      <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
        <Lock size={13} aria-hidden /> Sign in to see who
      </Link>
    </div>
  );
}

import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

const CHIPS = [
  { label: "For you", href: "/feed" },
  { label: "Places", href: "/explore#pl-h" },
  { label: "People", href: "/explore#cw-h" },
  { label: "Events", href: "/explore#tr-h" },
];

/** Search places, people and events — and the ways into Explore — at the top of the feed. */
export function FeedSearch() {
  return (
    <div className="mt-5">
      <form action="/explore" role="search" className="relative">
        <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <label htmlFor="feed-search" className="sr-only">Search places, people, events</label>
        <input id="feed-search" name="q" type="search" placeholder="Search places, people, events…" className="field !rounded-full !py-2.5 !pl-11" />
      </form>
      <nav aria-label="Explore" className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
        {CHIPS.map((c, i) => (
          <Link
            key={c.label}
            href={c.href}
            aria-current={i === 0 ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              i === 0 ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink hover:border-accent"
            )}
          >
            {c.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

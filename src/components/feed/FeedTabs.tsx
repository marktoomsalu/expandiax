import Link from "next/link";
import { Compass, Users } from "lucide-react";
import { cn } from "@/lib/utils";

/** Following | Explore — the feed of people you follow stays about them; exploring has its own view. */
export function FeedTabs({ tab }: { tab: "friends" | "explore" }) {
  const item = (on: boolean) =>
    cn(
      "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors",
      on ? "bg-accent text-white shadow-md shadow-accent/25" : "text-muted hover:text-ink"
    );
  return (
    <nav aria-label="Feed" className="flex rounded-full border border-line bg-surface p-1">
      <Link href="/feed" aria-current={tab === "friends" ? "page" : undefined} className={item(tab === "friends")}>
        <Users size={17} aria-hidden /> Following
      </Link>
      <Link href="/feed?tab=explore" aria-current={tab === "explore" ? "page" : undefined} className={item(tab === "explore")}>
        <Compass size={17} aria-hidden /> Explore
      </Link>
    </nav>
  );
}

/** A rounded search field that sends its query to `action` — `flush` drops its top margin, for sitting in a row. */
// Lives in its own file: it shows people as you type (a client component).
export { SearchBox } from "./SearchBox";

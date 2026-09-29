import Link from "next/link";
import { Compass, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";

/** Friends | Explore — your friends' feed stays about them; exploring has its own view. */
export function FeedTabs({ tab }: { tab: "friends" | "explore" }) {
  const item = (on: boolean) =>
    cn(
      "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors",
      on ? "bg-accent text-white shadow-md shadow-accent/25" : "text-muted hover:text-ink"
    );
  return (
    <nav aria-label="Feed" className="flex rounded-full border border-line bg-surface p-1">
      <Link href="/feed" aria-current={tab === "friends" ? "page" : undefined} className={item(tab === "friends")}>
        <Users size={17} aria-hidden /> Friends
      </Link>
      <Link href="/feed?tab=explore" aria-current={tab === "explore" ? "page" : undefined} className={item(tab === "explore")}>
        <Compass size={17} aria-hidden /> Explore
      </Link>
    </nav>
  );
}

/** A rounded search field that sends its query to `action`. */
export function SearchBox({ action, placeholder, defaultValue, hidden }: { action: string; placeholder: string; defaultValue?: string; hidden?: Record<string, string> }) {
  return (
    <form action={action} role="search" className="relative mt-3">
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
      <label htmlFor={`search-${action}`} className="sr-only">
        {placeholder}
      </label>
      <input id={`search-${action}`} name="q" type="search" defaultValue={defaultValue} placeholder={placeholder} className="field !rounded-full !py-2.5 !pl-11 text-sm" />
    </form>
  );
}

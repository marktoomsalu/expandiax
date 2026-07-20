"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Globe2, Music2, Rss, Settings, UserRound } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

type NavUser = { username: string } | null;

function Wordmark() {
  return (
    <Link href="/" className="font-serif text-lg tracking-tight text-ink">
      Expandia<span className="gradient-travel bg-clip-text text-transparent">X</span>
    </Link>
  );
}

export function SiteNav({ user }: { user: NavUser }) {
  const path = usePathname();
  const active = (href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(href + "/");

  const authedLinks = [
    { href: "/feed", label: "Feed", icon: Rss },
    { href: "/my-world", label: "My World", icon: Globe2 },
    { href: "/concerts", label: "Concerts", icon: Music2 },
    { href: `/u/${user?.username}`, label: "Profile", icon: UserRound },
    { href: "/settings", label: "Settings", icon: Settings },
  ];
  const guestLinks = [{ href: "/explore", label: "Explore", icon: Compass }];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-shell items-center justify-between px-5">
          <Wordmark />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {!user && (
              <>
                <Link href="/sign-in" className="hidden font-sans text-sm text-muted hover:text-ink sm:block">
                  Sign in
                </Link>
                <Link href="/sign-up" className="btn-accent !py-2 text-sm">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* App-style bottom tab bar — primary navigation at every screen size */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-2xl items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
          {(user ? authedLinks : [{ href: "/", label: "Home", icon: Compass }, ...guestLinks]).map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active(l.href) ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 font-sans text-[0.6875rem] transition-colors",
                  active(l.href) ? "text-accent" : "text-muted hover:text-ink"
                )}
              >
                <Icon size={20} strokeWidth={active(l.href) ? 2.25 : 1.75} />
                {l.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

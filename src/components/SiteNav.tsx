"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Globe2, Music2, Plus, Rss, UserRound } from "lucide-react";
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
  const [addOpen, setAddOpen] = useState(false);
  const active = (href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(href + "/");

  const leftLinks = [
    { href: "/feed", label: "Feed", icon: Rss },
    { href: "/my-world", label: "My World", icon: Globe2 },
  ];
  const rightLinks = [
    { href: "/concerts", label: "Concerts", icon: Music2 },
    { href: `/u/${user?.username}`, label: "Profile", icon: UserRound },
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
        {user ? (
          <div className="relative mx-auto flex max-w-2xl items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
            {leftLinks.map((l) => (
              <NavLink key={l.href} href={l.href} label={l.label} Icon={l.icon} isActive={active(l.href)} />
            ))}

            <div className="relative flex flex-1 items-center justify-center">
              {addOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setAddOpen(false)}
                    className="fixed inset-0 z-40 cursor-default"
                  />
                  <div
                    role="menu"
                    className="absolute bottom-full z-50 mb-4 w-48 overflow-hidden rounded-card border border-line bg-surface shadow-xl"
                  >
                    <Link
                      href="/my-world#country-search"
                      role="menuitem"
                      onClick={() => setAddOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-raised"
                    >
                      <Globe2 size={16} className="text-accent" /> Add a country
                    </Link>
                    <div className="h-px bg-line" aria-hidden />
                    <Link
                      href="/concerts/new"
                      role="menuitem"
                      onClick={() => setAddOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-raised"
                    >
                      <Music2 size={16} className="text-accent" /> Add a concert
                    </Link>
                  </div>
                </>
              )}
              <button
                type="button"
                aria-label="Add"
                aria-expanded={addOpen}
                onClick={() => setAddOpen((o) => !o)}
                className="absolute -top-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition-transform hover:scale-105"
              >
                <Plus size={26} strokeWidth={2.25} />
              </button>
            </div>

            {rightLinks.map((l) => (
              <NavLink key={l.href} href={l.href} label={l.label} Icon={l.icon} isActive={active(l.href)} />
            ))}
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
            {[{ href: "/", label: "Home", icon: Compass }, ...guestLinks].map((l) => (
              <NavLink key={l.href} href={l.href} label={l.label} Icon={l.icon} isActive={active(l.href)} />
            ))}
          </div>
        )}
      </nav>
    </>
  );
}

function NavLink({
  href,
  label,
  Icon,
  isActive,
}: {
  href: string;
  label: string;
  Icon: typeof Compass;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 py-2.5 font-sans text-[0.6875rem] transition-colors",
        isActive ? "text-accent" : "text-muted hover:text-ink"
      )}
    >
      <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} />
      {label}
    </Link>
  );
}

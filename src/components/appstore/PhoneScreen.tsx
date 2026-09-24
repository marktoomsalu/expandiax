import Image from "next/image";
import { Bell, Globe2, Plus, Rss, Sun, Ticket, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

// App Store screenshot tooling: one iPhone screen (393×852 pt) of the app,
// drawn with the app's own header/tab-bar markup (copied from SiteNav) so a
// headless browser can capture it at 3×. Covers the real site chrome with a
// fixed overlay. See scripts/appstore-screenshots.mjs.

export const SCREEN = { width: 393, height: 852, statusBar: 54 };

type Tab = "feed" | "world" | "events" | "profile" | null;

function StatusBar() {
  return (
    <div className="flex items-center justify-between bg-brand-purple px-8 font-sans text-white" style={{ height: SCREEN.statusBar }}>
      <span className="pt-1 text-[16px] font-semibold tracking-tight">9:41</span>
      <span className="flex items-center gap-1.5 pt-1" aria-hidden>
        <svg width="18" height="12" viewBox="0 0 18 12" fill="white">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="white">
          <path d="M8 11.5 10.3 9a3.3 3.3 0 0 0-4.6 0L8 11.5Zm-4.5-4.7 1.4 1.5a4.4 4.4 0 0 1 6.2 0l1.4-1.5a6.4 6.4 0 0 0-9 0ZM.5 3.7l1.4 1.5a8.6 8.6 0 0 1 12.2 0l1.4-1.5a10.6 10.6 0 0 0-15 0Z" />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="white" strokeOpacity="0.45" />
          <rect x="2" y="2" width="20" height="9" rx="2.2" fill="white" />
          <path d="M25 4.5v4a2 2 0 0 0 0-4Z" fill="white" fillOpacity="0.5" />
        </svg>
      </span>
    </div>
  );
}

function Header() {
  return (
    <div className="border-b border-white/10 bg-brand-purple">
      <div className="flex h-14 items-center justify-between px-5">
        <Image src="/wordmark.svg" alt="ExpandiaX" width={1780} height={522} priority className="h-6 w-auto" />
        <div className="flex items-center gap-3 text-white/70">
          <Bell size={19} />
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25">
            <Sun size={16} />
          </span>
        </div>
      </div>
    </div>
  );
}

function TabBar({ active }: { active: Tab }) {
  const link = (tab: Exclude<Tab, null>, label: string, Icon: typeof Rss) => (
    <span className={cn("flex flex-1 flex-col items-center gap-1 py-2.5 font-sans text-[0.6875rem]", active === tab ? "text-accent" : "text-white/55")}>
      <Icon size={20} strokeWidth={active === tab ? 2.25 : 1.75} />
      {label}
    </span>
  );
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-[98px] backdrop-blur-sm [background:linear-gradient(to_top,rgb(var(--canvas)/0.45)_0%,rgb(var(--canvas)/0.32)_25%,rgb(var(--canvas)/0.18)_50%,rgb(var(--canvas)/0.07)_75%,transparent_100%)]"
      />
      <nav className="absolute inset-x-4 bottom-[38px] z-40 rounded-full border border-white/10 bg-brand-purple/95 shadow-lg shadow-black/30 backdrop-blur">
        <div className="relative flex items-stretch justify-around px-2">
          {link("feed", "Feed", Rss)}
          {link("world", "My World", Globe2)}
          <div className="relative flex flex-1 items-center justify-center">
            <span className="absolute -top-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30">
              <Plus size={26} strokeWidth={2.25} />
            </span>
          </div>
          {link("events", "Events", Ticket)}
          {link("profile", "Profile", UserRound)}
        </div>
      </nav>
    </>
  );
}

export function PhoneScreen({ tab, children, chrome = true }: { tab: Tab; children: React.ReactNode; chrome?: boolean }) {
  return (
    <div
      className="fixed left-0 top-0 z-[1000] flex flex-col overflow-hidden bg-canvas text-ink antialiased"
      style={{ width: SCREEN.width, height: SCREEN.height }}
    >
      <StatusBar />
      {chrome && <Header />}
      <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
      <TabBar active={tab} />
      <span aria-hidden className="absolute bottom-2 left-1/2 z-50 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-black/85" />
    </div>
  );
}

import Image from "next/image";
import { Bell, Globe2, MessageCircle, Moon, Plus, Rss, Ticket, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

// App Store screenshot tooling: one device screen of the app, drawn with the
// app's own header/tab-bar markup (copied from SiteNav) as a fixed overlay
// over the real site chrome. Fills whatever viewport it's captured at —
// iPhone (393×852 pt) or iPad (1032×1376 pt); md: switches to iPad system
// UI. See scripts/appstore-screenshots.mjs.

type Tab = "feed" | "world" | "events" | "profile" | null;
export type ScreenOs = "ios" | "android";

// Android (Pixel-style): shorter bar, time on the left, the camera sits in a
// punch-hole the frame draws, battery is upright.
function AndroidStatusBar() {
  return (
    <div className="flex h-9 items-center justify-between bg-brand-purple px-6 font-sans text-[13px] font-medium text-white">
      <span>12:30</span>
      <span className="flex items-center gap-1.5" aria-hidden>
        <svg width="15" height="12" viewBox="0 0 16 12" fill="white">
          <path d="M8 11.5 10.3 9a3.3 3.3 0 0 0-4.6 0L8 11.5Zm-4.5-4.7 1.4 1.5a4.4 4.4 0 0 1 6.2 0l1.4-1.5a6.4 6.4 0 0 0-9 0ZM.5 3.7l1.4 1.5a8.6 8.6 0 0 1 12.2 0l1.4-1.5a10.6 10.6 0 0 0-15 0Z" />
        </svg>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
          <path d="M12 0v12H0z" />
        </svg>
        <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
          <rect x="2.5" y="0" width="3" height="1.5" rx="0.5" fill="white" />
          <rect x="0.5" y="1.5" width="7" height="11" rx="1.5" fill="white" />
        </svg>
      </span>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="flex h-[54px] items-center justify-between bg-brand-purple px-8 font-sans text-white md:h-6 md:px-5">
      <span className="pt-1 text-[16px] font-semibold tracking-tight md:pt-0 md:text-[12px]">
        9:41<span className="ml-1.5 hidden font-medium md:inline">Tue 9 Sep</span>
      </span>
      <span className="flex items-center gap-1.5 pt-1 md:pt-0" aria-hidden>
        <svg width="18" height="12" viewBox="0 0 18 12" fill="white" className="md:hidden">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="white">
          <path d="M8 11.5 10.3 9a3.3 3.3 0 0 0-4.6 0L8 11.5Zm-4.5-4.7 1.4 1.5a4.4 4.4 0 0 1 6.2 0l1.4-1.5a6.4 6.4 0 0 0-9 0ZM.5 3.7l1.4 1.5a8.6 8.6 0 0 1 12.2 0l1.4-1.5a10.6 10.6 0 0 0-15 0Z" />
        </svg>
        <span className="hidden text-[12px] font-medium md:inline">100%</span>
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
      <div className="mx-auto flex h-14 max-w-shell items-center justify-between px-5">
        <Image src="/wordmark.svg" alt="ExpandiaX" width={1780} height={522} priority className="h-6 w-auto" />
        {/* As in the app: World Connect, notifications, light/dark. */}
        <div className="flex items-center gap-3 text-white/75">
          <Globe2 size={20} />
          <Bell size={19} />
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25">
            <Moon size={16} />
          </span>
        </div>
      </div>
    </div>
  );
}

function TabBar({ active, os }: { active: Tab; os: ScreenOs }) {
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
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-[98px] backdrop-blur-sm [background:linear-gradient(to_top,rgb(var(--canvas)/0.45)_0%,rgb(var(--canvas)/0.32)_25%,rgb(var(--canvas)/0.18)_50%,rgb(var(--canvas)/0.07)_75%,transparent_100%)] md:h-[84px]"
      />
      <nav
        className={cn(
          "absolute inset-x-4 z-40 mx-auto max-w-2xl rounded-full border border-white/10 bg-brand-purple/95 shadow-lg shadow-black/30 backdrop-blur",
          os === "android" ? "bottom-[26px]" : "bottom-[38px] md:bottom-[24px]"
        )}
      >
        <div className="relative flex items-stretch justify-around px-2">
          {link("feed", "Feed", Rss)}
          {link("world", "Countries", Globe2)}
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

export function PhoneScreen({ tab, os = "ios", chat = true, children }: { tab: Tab; os?: ScreenOs; chat?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[1000] flex flex-col overflow-hidden bg-canvas text-ink antialiased">
      {os === "android" ? <AndroidStatusBar /> : <StatusBar />}
      <Header />
      <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
      <TabBar active={tab} os={os} />
      {/* The chat bubble, in its corner just above the tab bar, as in the app. */}
      {chat && (
        <span
          aria-hidden
          className={cn(
            "absolute right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl shadow-black/25",
            os === "android" ? "bottom-[104px]" : "bottom-[116px] md:bottom-[100px]"
          )}
          style={{ background: "linear-gradient(135deg, #fa51a2, #fb7822)" }}
        >
          <MessageCircle size={24} strokeWidth={2.2} />
        </span>
      )}
      <span
        aria-hidden
        className={cn(
          "absolute bottom-2 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/85",
          os === "android" ? "h-1 w-[108px]" : "h-[5px] w-[134px] md:w-[320px]"
        )}
      />
    </div>
  );
}

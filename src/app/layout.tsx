import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Image from "next/image";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SiteNav } from "@/components/SiteNav";
import { PremiumUpsellModal } from "@/components/PremiumUpsellModal";
import { NativeStatusBar } from "@/components/NativeStatusBar";
import { NativeBackButton } from "@/components/NativeBackButton";
import { NativeDeepLinks } from "@/components/NativeDeepLinks";
import { NativeKeyboard } from "@/components/NativeKeyboard";
import { PushRegistration } from "@/components/PushRegistration";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  metadataBase: new URL("https://expandiax.com"),
  title: { default: "ExpandiaX - Your world, remembered.", template: "%s · ExpandiaX" },
  description:
    "Track the countries you have explored, preserve the moments that mattered and build a visual archive of every event that made you feel alive.",
  openGraph: {
    siteName: "ExpandiaX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ExpandiaX",
  },
};

export const viewport: Viewport = {
  themeColor: "#E91E63",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let navUser: { id: string; username: string; plan: "free" | "premium" } | null = null;
  let unreadNotifications = 0;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const [{ data: profile }, { count }] = await Promise.all([
        supabase.from("profiles").select("username, plan").eq("id", user.id).single(),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false),
      ]);
      if (profile) navUser = { id: user.id, username: profile.username, plan: profile.plan };
      unreadNotifications = count ?? 0;
    }
  } catch {
    // Supabase not configured yet — render the logged-out shell.
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen pb-20">
        <ThemeProvider>
          <NativeStatusBar />
          <NativeBackButton />
          <NativeDeepLinks />
          <NativeKeyboard />
          {navUser && <PushRegistration userId={navUser.id} />}
          <SiteNav user={navUser} unreadNotifications={unreadNotifications} />
          <main>{children}</main>
          {navUser && <PremiumUpsellModal plan={navUser.plan} />}
          <footer className="mt-20 border-t border-line">
            <div className="mx-auto max-w-shell px-5 py-8">
              <div className="flex flex-col items-start justify-between gap-3 text-sm text-muted sm:flex-row sm:items-center">
                <p className="flex items-center">
                  <Image src="/wordmark.svg" alt="ExpandiaX" width={1780} height={522} className="h-5 w-auto" />
                </p>
                <p>Collecting the memories that matter.</p>
              </div>
              <div className="mt-6 flex flex-col items-start justify-between gap-3 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center">
                <p>&copy; {new Date().getFullYear()} ExpandiaX. All rights reserved.</p>
                <div className="flex items-center gap-4">
                  <Link href="/terms" className="hover:text-ink">Terms</Link>
                  <Link href="/privacy" className="hover:text-ink">Privacy</Link>
                </div>
              </div>
            </div>
          </footer>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

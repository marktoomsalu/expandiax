import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SiteNav } from "@/components/SiteNav";
import { SiteChrome } from "@/components/SiteChrome";
import { PremiumUpsellModal } from "@/components/PremiumUpsellModal";
import { NativeStatusBar } from "@/components/NativeStatusBar";
import { NativeBackButton } from "@/components/NativeBackButton";
import { NativeDeepLinks } from "@/components/NativeDeepLinks";
import { NativeKeyboard } from "@/components/NativeKeyboard";
import { NativeFirstRunRedirect } from "@/components/NativeFirstRunRedirect";
import { PushRegistration } from "@/components/PushRegistration";
import { NativePurchases } from "@/components/NativePurchases";
import { PurchaseAvailabilityProvider } from "@/components/PurchaseAvailability";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { canSellPremium } from "@/lib/nativeAppServer";

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
  // Site ownership check for Impact (Ticketmaster's affiliate network).
  other: { "impact-site-verification": "f783cf38-a960-4e45-bce3-398fda1dd5f9" },
};

export const viewport: Viewport = {
  themeColor: "#2B0B2E", // matches the header's fixed brand-purple background
  // Required before env(safe-area-inset-*) resolves to anything but 0 on
  // iOS — without it, the header/bottom nav's safe-area padding below was
  // silently a no-op, and the bottom tab bar sat flush against the home
  // indicator instead of clearing it.
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let navUser: { id: string; username: string; plan: "free" | "premium" } | null = null;
  let unreadNotifications = 0;
  const canSell = canSellPremium();
  try {
    const supabase = createClient();
    const user = await getAuthUser();
    if (user) {
      let unread = supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false);
      // Upsell notifications are hidden in the app, so they mustn't light up the bell either.
      if (!canSell) unread = unread.neq("kind", "premium_upsell");
      const [{ data: profile }, { count }] = await Promise.all([
        supabase.from("profiles").select("username, plan").eq("id", user.id).single(),
        unread,
      ]);
      if (profile) navUser = { id: user.id, username: profile.username, plan: profile.plan };
      unreadNotifications = count ?? 0;
    }
  } catch {
    // Supabase not configured yet — render the logged-out shell.
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider>
          <PurchaseAvailabilityProvider canSell={canSell}>
            <NativeStatusBar />
            <NativeBackButton />
            <NativeDeepLinks />
            <NativeKeyboard />
            <NativeFirstRunRedirect isLoggedIn={!!navUser} />
            {navUser && <PushRegistration userId={navUser.id} />}
            {navUser && <NativePurchases userId={navUser.id} />}
            <SiteNav user={navUser} unreadNotifications={unreadNotifications} />
            <SiteChrome>{children}</SiteChrome>
            {navUser && canSell && <PremiumUpsellModal plan={navUser.plan} />}
          </PurchaseAvailabilityProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

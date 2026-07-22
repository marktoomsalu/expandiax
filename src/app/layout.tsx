import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SiteNav } from "@/components/SiteNav";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  metadataBase: new URL("https://expandiax.com"),
  title: { default: "ExpandiaX — Your world, remembered.", template: "%s · ExpandiaX" },
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
  themeColor: "#ff6347",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let navUser: { username: string } | null = null;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();
      if (profile) navUser = { username: profile.username };
    }
  } catch {
    // Supabase not configured yet — render the logged-out shell.
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen pb-20">
        <ThemeProvider>
          <SiteNav user={navUser} />
          <main>{children}</main>
          <footer className="mt-20 border-t border-line">
            <div className="mx-auto max-w-shell px-5 py-8">
              <div className="flex flex-col items-start justify-between gap-3 text-sm text-muted sm:flex-row sm:items-center">
                <p className="font-serif text-ink">
                  Expandia<span className="gradient-travel bg-clip-text text-transparent">X</span>
                </p>
                <p>A private archive for collecting the memories that matter — every place you&rsquo;ve been, every night worth remembering.</p>
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
      </body>
    </html>
  );
}

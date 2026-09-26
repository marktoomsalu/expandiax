"use client";

import { Browser } from "@capacitor/browser";
import { isNativePlatform } from "@/lib/capacitor";

// An outside website (tickets, setlist.fm): a new tab on the web, the in-app
// browser in the native app — where target="_blank" isn't reliable and the
// person should land back in ExpandiaX when they close it.
export function ExternalLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(e) => {
        if (!isNativePlatform()) return;
        e.preventDefault();
        void Browser.open({ url: href });
      }}
    >
      {children}
    </a>
  );
}

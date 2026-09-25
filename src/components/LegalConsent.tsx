"use client";

import Link from "next/link";
import { Browser } from "@capacitor/browser";
import { isNativePlatform } from "@/lib/capacitor";
import { MIN_AGE } from "@/lib/legal";

// A plain link would replace the sign-up page (and lose what's been typed);
// a new tab does the job on the web, and the in-app browser does it in the
// native app, where target="_blank" isn't reliable.
function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline underline-offset-2"
      onClick={(e) => {
        if (!isNativePlatform()) return;
        e.preventDefault();
        void Browser.open({ url: `${window.location.origin}${href}` });
      }}
    >
      {children}
    </Link>
  );
}

/** Sign-up: an explicit tick, not a footnote. */
export function ConsentCheckbox({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 accent-[rgb(var(--accent))]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
      />
      <span>
        I&rsquo;m {MIN_AGE} or older, and I agree to the <LegalLink href="/terms">Terms of Service</LegalLink> and{" "}
        <LegalLink href="/privacy">Privacy Policy</LegalLink>.
      </span>
    </label>
  );
}

/** Sign-in: Apple and Google can create an account here too, so say what continuing means. */
export function ConsentNotice() {
  return (
    <p className="mt-3 text-xs leading-relaxed text-muted">
      New here? By continuing with Apple or Google you agree to the <LegalLink href="/terms">Terms of Service</LegalLink> and{" "}
      <LegalLink href="/privacy">Privacy Policy</LegalLink>, and confirm you&rsquo;re {MIN_AGE} or older.
    </p>
  );
}

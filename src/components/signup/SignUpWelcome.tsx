"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AppleSignInButton } from "@/components/AppleSignInButton";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { LegalLink } from "@/components/LegalConsent";
import { TOTAL_COUNTRIES } from "@/lib/countries";
import { MIN_AGE } from "@/lib/legal";
import { keptCountries, loadKeptWorld, type KeptWorld } from "@/lib/worldScan";

const WorldGlobeInner = dynamic(() => import("@/components/WorldGlobeInner").then((m) => m.WorldGlobeInner), {
  ssr: false,
  loading: () => <div className="h-[260px] w-full" />,
});

/**
 * Signing up, the quick way first (iPhone app builds with Find my world):
 * the same page as ever, in the app's own look, with Apple and Google as
 * the two big ways in and email as a smaller one. After Find my world it
 * shows the world that's waiting to be saved.
 */
export function SignUpWelcome({ onEmail }: { onEmail: () => void }) {
  const [world, setWorld] = useState<KeptWorld | null>(null);
  useEffect(() => setWorld(loadKeptWorld()), []);
  const codes = useMemo(() => (world ? keptCountries(world) : []), [world]);
  const memories = world?.events?.length ?? 0;
  const theirs = codes.length > 0;
  const pct = Math.round((codes.length / TOTAL_COUNTRIES) * 1000) / 10;

  return (
    <div className="mx-auto flex max-w-md flex-col px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-12">
      <p className="eyebrow">Create account</p>
      <h1 className="mt-2 text-3xl md:text-4xl">
        {theirs ? (
          <>
            Save <span className="italic text-accent">your world.</span>
          </>
        ) : (
          "Begin your journey."
        )}
      </h1>
      <p className="mt-3 text-sm text-muted">
        {theirs
          ? `${codes.length} ${codes.length === 1 ? "country" : "countries"}${memories ? ` and ${memories} ${memories === 1 ? "memory" : "memories"}` : ""}, ready to keep.`
          : "One place for every country you’ve set foot in and every event you never want to forget."}
      </p>

      <div className="mt-6">
        <WorldGlobeInner visitedCodes={codes} homeCode={world?.homeCode ?? undefined} interactive={false} labels={false} autoRotate />
        {theirs && (
          <p className="mt-2 text-center text-sm text-muted">
            <span className="stat-number !text-base">{codes.length}</span> of {TOTAL_COUNTRIES} countries · {pct}% of the world
          </p>
        )}
      </div>

      <div className="mt-8 space-y-3">
        <AppleSignInButton
          next="/onboarding"
          label="Sign up with Apple"
          className="btn-apple w-full gap-2.5 !rounded-full !py-4 text-base disabled:opacity-50"
        />
        <GoogleSignInButton
          next="/onboarding"
          label="Sign up with Google"
          className="btn-ghost w-full gap-2.5 !rounded-full !py-4 text-base disabled:opacity-50"
        />
        <div className="pt-1 text-center">
          <button type="button" onClick={onEmail} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
            Sign up with email
          </button>
        </div>
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted">
        By continuing, you confirm you&rsquo;re {MIN_AGE} or older and agree to the <LegalLink href="/terms">Terms of Service</LegalLink> and{" "}
        <LegalLink href="/privacy">Privacy Policy</LegalLink>.
      </p>
      <p className="mt-4 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-accent underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

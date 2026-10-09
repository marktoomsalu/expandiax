"use client";

import Link from "next/link";
import { Globe2, Ticket } from "lucide-react";
import { Rise } from "./StepTransition";

export function ForkStep({ onChoose }: { onChoose: (kind: "country" | "event") => void }) {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(4rem+env(safe-area-inset-top))]">
      <div className="flex flex-1 flex-col justify-center">
        <p className="eyebrow text-center">Step 1</p>
        <h1 className="mt-2 text-center text-3xl md:text-4xl">What do you want to remember?</h1>

        <div className="mt-10 space-y-4">
          <Rise delay={0.1}>
            <button
              type="button"
              onClick={() => onChoose("country")}
              className="card flex w-full items-center gap-4 px-5 py-5 text-left transition-shadow hover:shadow-lg"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Globe2 size={22} />
              </span>
              <span>
                <span className="block font-serif text-lg">A place I&rsquo;ve been to</span>
                <span className="mt-0.5 block text-sm text-muted">Pin your home country and where you&rsquo;ve traveled.</span>
              </span>
            </button>
          </Rise>

          <Rise delay={0.22}>
            <button
              type="button"
              onClick={() => onChoose("event")}
              className="card flex w-full items-center gap-4 px-5 py-5 text-left transition-shadow hover:shadow-lg"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Ticket size={22} />
              </span>
              <span>
                <span className="block font-serif text-lg">An event I attended</span>
                <span className="mt-0.5 block text-sm text-muted">One event that still means something.</span>
              </span>
            </button>
          </Rise>
        </div>
      </div>

      <Rise delay={0.4} className="pt-10 text-center">
        <Link href="/sign-in" className="text-sm text-muted hover:text-ink">
          I already have an account
        </Link>
      </Rise>
    </div>
  );
}

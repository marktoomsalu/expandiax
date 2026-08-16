"use client";

import { Globe2, Ticket } from "lucide-react";

export function ForkStep({ onChoose }: { onChoose: (kind: "country" | "event") => void }) {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 py-16">
      <p className="eyebrow text-center">Step 1</p>
      <h1 className="mt-2 text-center text-3xl md:text-4xl">What do you want to start with?</h1>

      <div className="mt-10 space-y-4">
        <button
          type="button"
          onClick={() => onChoose("country")}
          className="card flex w-full items-center gap-4 px-5 py-5 text-left transition-shadow hover:shadow-lg"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Globe2 size={22} />
          </span>
          <span>
            <span className="block font-serif text-lg">A place I&rsquo;ve been</span>
            <span className="mt-0.5 block text-sm text-muted">Pin your home country and where you&rsquo;ve traveled.</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChoose("event")}
          disabled
          aria-disabled
          className="card flex w-full items-center gap-4 px-5 py-5 text-left opacity-50"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Ticket size={22} />
          </span>
          <span>
            <span className="block font-serif text-lg">A night I want to remember</span>
            <span className="mt-0.5 block text-sm text-muted">Coming soon.</span>
          </span>
        </button>
      </div>
    </div>
  );
}

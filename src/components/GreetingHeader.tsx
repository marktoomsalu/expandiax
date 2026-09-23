"use client";

import { useEffect, useState } from "react";

// Server-rendered time would use the server's clock, not the viewer's — a
// visitor in Tokyo could get "Good evening" at their own 9am. Computed
// client-side on mount instead, with a tense-neutral fallback for the
// instant before that runs.
function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Still up,";
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

export function GreetingHeader({ firstName }: { firstName: string }) {
  const [greeting, setGreeting] = useState("Welcome back,");
  useEffect(() => setGreeting(timeGreeting()), []);

  return (
    <h1 className="mt-2 text-3xl md:text-4xl">
      {greeting} <span className="text-accent">{firstName}</span>
    </h1>
  );
}

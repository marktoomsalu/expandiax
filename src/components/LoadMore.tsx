"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tapLight } from "@/lib/haptics";

// Where you were when you asked for more: the last post on screen and how
// far it sat from the top. Kept outside React so it survives the page
// re-rendering with the longer list.
let anchor: { key: string; top: number } | null = null;

function lastVisible(): HTMLElement | null {
  const posts = [...document.querySelectorAll<HTMLElement>("[data-feed-key]")];
  const onScreen = posts.filter(
    (p) => p.getBoundingClientRect().top < window.innerHeight
  );
  return onScreen[onScreen.length - 1] ?? posts[posts.length - 1] ?? null;
}

/**
 * "Load more" for the feed that keeps your place: more posts appear below
 * the one you were looking at, instead of the page jumping back up.
 */
export function LoadMore({
  href,
  shown,
  more,
}: {
  href: string;
  shown: number;
  more: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // Once the longer list is on screen, put the same post back where it was.
  useEffect(() => {
    if (!anchor) return;
    const el = document.querySelector<HTMLElement>(
      `[data-feed-key="${CSS.escape(anchor.key)}"]`
    );
    if (el)
      window.scrollBy({
        top: el.getBoundingClientRect().top - anchor.top,
        behavior: "instant" as ScrollBehavior,
      });
    anchor = null;
  }, [shown]);

  // Stays mounted after the last page, so the place is still kept.
  if (!more) return null;
  return (
    <div className="mt-8 flex justify-center">
      <button
        type="button"
        className="btn-ghost"
        disabled={pending}
        onClick={() => {
          tapLight();
          const el = lastVisible();
          anchor = el
            ? {
                key: el.dataset.feedKey ?? "",
                top: el.getBoundingClientRect().top,
              }
            : null;
          start(() => router.push(href, { scroll: false }));
        }}
      >
        {pending ? "Loading…" : "Load more"}
      </button>
    </div>
  );
}

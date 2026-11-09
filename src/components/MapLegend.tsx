import { DREAM_RGB, HOME_RGB, rgb, visitedColor } from "@/lib/mapColors";

/** What the globe's colours mean. Pink covers home and places you lived. */
export function MapLegend({ hasHome, hasLived, hasDreams = false, hint }: { hasHome: boolean; hasLived: boolean; hasDreams?: boolean; hint?: string }) {
  const pinkLabel = hasHome && hasLived ? "Home & lived" : hasLived ? "Lived here" : "Home";
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-2 pb-1 pt-3 text-xs text-muted">
      <span className="flex items-center gap-2">
        <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: visitedColor(1) }} /> Visited
      </span>
      {(hasHome || hasLived) && (
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: rgb(HOME_RGB) }} /> {pinkLabel}
        </span>
      )}
      {hasDreams && (
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: rgb(DREAM_RGB) }} /> Dreaming
        </span>
      )}
      <span className="flex items-center gap-2">
        <span aria-hidden className="h-2.5 w-5 rounded-full" style={{ backgroundImage: `linear-gradient(90deg, ${visitedColor(1)}, ${visitedColor(99)})` }} /> Brighter = visited more than once
      </span>
      {hint && <span className="ml-auto hidden sm:block">{hint}</span>}
    </div>
  );
}

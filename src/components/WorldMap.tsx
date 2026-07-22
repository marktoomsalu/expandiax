"use client";

import dynamic from "next/dynamic";

type Props = {
  visitedCodes: string[];
  visitCounts?: Record<string, number>;
  homeCode?: string | null;
  onSelect?: (code: string) => void;
  interactive?: boolean;
  className?: string;
};

const WorldGlobeInner = dynamic(
  () => import("./WorldGlobeInner").then((m) => m.WorldGlobeInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[320px] items-center justify-center text-sm text-muted sm:h-[420px]">
        Loading the globe…
      </div>
    ),
  }
);

/**
 * A rotating 3D globe: visited countries take the brass accent, the rest stay
 * quiet. Precision selection on mobile is handled by the country search next
 * to the globe, so polygon clicks are pointer-targets only.
 */
export function WorldMap({ visitedCodes, visitCounts, homeCode, onSelect, interactive = true, className }: Props) {
  return (
    <WorldGlobeInner
      visitedCodes={visitedCodes}
      visitCounts={visitCounts}
      homeCode={homeCode}
      onSelect={onSelect}
      interactive={interactive}
      className={className}
    />
  );
}

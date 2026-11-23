"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { Topology } from "topojson-specification";
import { drawGlobe, worldFeatures, type WorldFeature } from "@/lib/globeArt";

let world: Promise<WorldFeature[]> | null = null;
const loadWorld = () => (world ??= fetch("/data/world-110m.json").then((r) => r.json() as Promise<Topology>).then(worldFeatures));
/** Start loading the map ahead of time, so the globe is drawn the moment it's shown. */
export const warmGlobe = () => void loadWorld().catch(() => (world = null));

/** The world map's shapes, once loaded (shared by every globe on the page). */
export function useWorldFeatures(): WorldFeature[] | null {
  const [features, setFeatures] = useState<WorldFeature[] | null>(null);
  useEffect(() => {
    let alive = true;
    void loadWorld().then((f) => alive && setFeatures(f));
    return () => {
      alive = false;
    };
  }, []);
  return features;
}

/**
 * The Earth at night as a picture, not a 3D scene: quick to show, light on
 * the phone. Their countries glow; the route is drawn in, line by line.
 */
export function GlobePicture({
  countries,
  home,
  route,
  tilt = 0,
  className,
  drawDelay = 0.3,
}: {
  countries: string[];
  home?: string | null;
  route?: string[];
  tilt?: number;
  className?: string;
  /** When the route starts drawing (seconds). */
  drawDelay?: number;
}) {
  const id = useId().replace(/:/g, "");
  const features = useWorldFeatures();
  const S = 600;
  const art = useMemo(() => (features ? drawGlobe(features, { size: S, countries, home, route, tilt }) : null), [features, countries, home, route, tilt]);

  return (
    <svg viewBox={`-30 -30 ${S + 60} ${S + 60}`} className={className} role="img" aria-label="Your countries on the globe">
      <defs>
        <radialGradient id={`${id}o`} cx="42%" cy="38%" r="70%">
          <stop offset="0" stopColor="#1d2c52" />
          <stop offset="0.7" stopColor="#0f1834" />
          <stop offset="1" stopColor="#080d20" />
        </radialGradient>
        <radialGradient id={`${id}a`} cx="50%" cy="50%" r="50%">
          <stop offset="0.86" stopColor="#8b5cf6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff6cb5" />
          <stop offset="1" stopColor="#fb7822" />
        </linearGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffd1e8" />
          <stop offset="1" stopColor="#fa51a2" />
        </linearGradient>
        <radialGradient id={`${id}s`} cx="32%" cy="26%" r="60%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}g`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* The atmosphere */}
      <circle cx={S / 2} cy={S / 2} r={S * 0.53} fill={`url(#${id}a)`} />
      {art && (
        <>
          <path d={art.sphere} fill={`url(#${id}o)`} />
          <path d={art.land} fill="#22325c" stroke="#33467a" strokeWidth={0.6} />
          {art.lit.map((c) => (
            <path key={c.code} d={c.d} fill={c.home ? "#fb7822" : `url(#${id}l)`} stroke="#ffb3d6" strokeWidth={0.6} filter={`url(#${id}g)`} />
          ))}
          <path d={art.sphere} fill={`url(#${id}s)`} />
          {art.arcs.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={`url(#${id}r)`}
              strokeWidth={3.4}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1}
              filter={`url(#${id}g)`}
              className="animate-draw-line"
              style={{ animationDelay: `${drawDelay + i * 0.22}s` }}
            />
          ))}
          {art.dots.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={5.5} fill="#fff" filter={`url(#${id}g)`} />
          ))}
        </>
      )}
    </svg>
  );
}

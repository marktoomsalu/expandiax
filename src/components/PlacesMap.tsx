"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { cn } from "@/lib/utils";

export type MapPoint = { id: string; name: string; lat: number; lng: number; label?: string };

// OpenFreeMap: free map tiles, no key; its styles carry the credit its licence asks for.
const STYLE = { light: "https://tiles.openfreemap.org/styles/positron", dark: "https://tiles.openfreemap.org/styles/dark" };
const PINK = "#FA51A2";

/**
 * A real map of places — numbered pins, and (for a journey) the route between
 * them in order. The map library is only loaded once the map is on screen.
 */
export function PlacesMap({ points, route = false, className }: { points: MapPoint[]; route?: boolean; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const key = points.map((p) => `${p.id}:${p.lat},${p.lng}`).join("|");
  useEffect(() => {
    if (!visible || !box.current || points.length === 0) return;
    let map: import("maplibre-gl").Map | null = null;
    let cancelled = false;
    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !box.current) return;
      // Its worker can't be found once bundled; it's served from /public (see scripts/copy-maplibre-worker.mjs).
      maplibre.setWorkerUrl(`/maplibre/${maplibre.getVersion()}/maplibre-gl-worker.mjs`);
      const dark = document.documentElement.classList.contains("dark");
      const m = new maplibre.Map({
        container: box.current,
        style: dark ? STYLE.dark : STYLE.light,
        center: [points[0].lng, points[0].lat],
        zoom: 9,
        attributionControl: false,
        // One finger scrolls the page; two fingers (or ctrl + scroll) move the map.
        cooperativeGestures: true,
      });
      map = m;
      m.addControl(new maplibre.AttributionControl({ compact: true }));
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");

      points.forEach((p, i) => {
        const pin = document.createElement("div");
        pin.className = "flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg";
        pin.style.background = PINK;
        pin.textContent = route ? String(i + 1) : "";
        pin.title = p.name;
        new maplibre.Marker({ element: pin })
          .setLngLat([p.lng, p.lat])
          .setPopup(new maplibre.Popup({ offset: 16, closeButton: false }).setText(p.label ? `${p.name} · ${p.label}` : p.name))
          .addTo(m);
      });

      if (points.length > 1) {
        const bounds = new maplibre.LngLatBounds();
        points.forEach((p) => bounds.extend([p.lng, p.lat]));
        m.fitBounds(bounds, { padding: 56, maxZoom: 11, duration: 0 });
      }

      if (route && points.length > 1) {
        m.on("load", () => {
          m.addSource("route", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points.map((p) => [p.lng, p.lat]) } },
          });
          m.addLayer({
            id: "route",
            type: "line",
            source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": PINK, "line-width": 3, "line-dasharray": [1.5, 1.5] },
          });
        });
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, key, route]);

  return <div ref={box} className={cn("h-72 w-full overflow-hidden rounded-2xl border border-line bg-raised", className)} aria-label="Map of places" role="region" />;
}

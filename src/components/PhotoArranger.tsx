"use client";

import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { tapLight, tapSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export type ArrangeItem = { id: string; thumb: string | null; isVideo: boolean };

/**
 * Photos you can put in order by dragging: press and hold one (or just drag
 * it with a mouse), move it where it should go, let go. Dropping it on the
 * Cover slot makes it the cover. Each tile's own content (the image, its
 * buttons) comes from `renderTile`; this only handles moving them.
 */
export function PhotoArranger({
  items,
  coverId,
  onReorder,
  onCover,
  renderTile,
}: {
  items: ArrangeItem[];
  coverId: string | null;
  onReorder: (ids: string[]) => void;
  /** Without it there's no Cover slot (nothing to be the cover of). */
  onCover?: (id: string) => void;
  renderTile: (id: string, dragging: boolean) => React.ReactNode;
}) {
  const [order, setOrder] = useState(items.map((i) => i.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [overCover, setOverCover] = useState(false);
  const start = useRef<{ id: string; x: number; y: number; type: string; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const orderRef = useRef(order);
  orderRef.current = order;
  const overCoverRef = useRef(false);
  overCoverRef.current = overCover;

  // New photos from the page, unless one is being moved right now.
  const key = items.map((i) => i.id).join(",");
  useEffect(() => {
    if (!dragId) setOrder(items.map((i) => i.id));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = new Map(items.map((i) => [i.id, i]));

  // While a photo is held, the page doesn't scroll under the finger. The
  // listener is there from the start (iOS only honours it that way) and
  // only acts during a drag.
  const boxRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  draggingRef.current = !!dragId;
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const stopScroll = (e: TouchEvent) => {
      if (draggingRef.current) e.preventDefault();
    };
    el.addEventListener("touchmove", stopScroll, { passive: false });
    document.addEventListener("touchmove", stopScroll, { passive: false });
    return () => {
      el.removeEventListener("touchmove", stopScroll);
      document.removeEventListener("touchmove", stopScroll);
    };
  }, []);

  useEffect(() => {
    function move(e: PointerEvent) {
      const s = start.current;
      if (!s) return;
      if (!dragId) {
        const far = Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8;
        // A finger that moves before the hold is a scroll, not a drag.
        if (far && s.type !== "mouse") {
          clearTimeout(s.timer);
          start.current = null;
        } else if (far) {
          begin(s.id, e.clientX, e.clientY);
        }
        return;
      }
      setGhost({ x: e.clientX, y: e.clientY });
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-arrange-id],[data-arrange-cover]");
      if (target?.dataset.arrangeCover !== undefined) {
        setOverCover(true);
        return;
      }
      setOverCover(false);
      const overId = target?.dataset.arrangeId;
      if (!overId || overId === dragId) return;
      const cur = orderRef.current;
      const to = cur.indexOf(overId);
      const next = cur.filter((id) => id !== dragId);
      next.splice(to, 0, dragId);
      setOrder(next);
    }
    function up() {
      const s = start.current;
      if (s?.timer) clearTimeout(s.timer);
      start.current = null;
      if (!dragId) return;
      if (overCoverRef.current && onCover) {
        tapSuccess();
        onCover(dragId);
        setOrder(items.map((i) => i.id));
      } else if (orderRef.current.join(",") !== items.map((i) => i.id).join(",")) {
        tapLight();
        onReorder(orderRef.current);
      }
      setDragId(null);
      setGhost(null);
      setOverCover(false);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  function begin(id: string, x: number, y: number) {
    tapLight();
    setDragId(id);
    setGhost({ x, y });
  }

  function down(e: React.PointerEvent, id: string) {
    if (e.button > 0) return;
    // Buttons and fields on a tile keep working as usual.
    if ((e.target as HTMLElement).closest("button, input, select, a, textarea")) return;
    const s = { id, x: e.clientX, y: e.clientY, type: e.pointerType } as NonNullable<typeof start.current>;
    if (e.pointerType !== "mouse") s.timer = setTimeout(() => start.current && begin(id, s.x, s.y), 280);
    start.current = s;
  }

  const cover = coverId ? byId.get(coverId) : null;
  const dragged = dragId ? byId.get(dragId) : null;

  return (
    <div ref={boxRef} className="select-none [-webkit-touch-callout:none]">
      {onCover && (
        <div
          data-arrange-cover=""
          className={cn(
            "relative mb-3 flex h-28 items-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed p-2 transition-colors",
            overCover ? "border-accent bg-accent-soft" : dragId ? "border-accent/50" : "border-line"
          )}
        >
          <span className="relative h-full w-36 shrink-0 overflow-hidden rounded-xl bg-raised">
            {cover?.thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover.thumb} alt="Cover photo" draggable={false} className="h-full w-full object-cover" />
            )}
            <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              <Star size={10} aria-hidden /> Cover
            </span>
          </span>
          <span className="text-sm text-muted">
            {dragId ? (overCover ? "Let go to make it the cover" : "Drop here to make it the cover") : "Hold a photo and drag it here to make it the cover, or anywhere below to reorder."}
          </span>
        </div>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {order.map((id) => {
          const item = byId.get(id);
          if (!item) return null;
          const moving = id === dragId;
          return (
            <li
              key={id}
              data-arrange-id={id}
              onPointerDown={(e) => down(e, id)}
              onContextMenu={(e) => e.preventDefault()}
              className={cn(
                "relative overflow-hidden rounded-lg border bg-raised transition-[transform,opacity] duration-150",
                moving ? "scale-95 border-dashed border-accent opacity-40" : "border-line",
                dragId && !moving && "cursor-grabbing"
              )}
              style={{ touchAction: dragId ? "none" : "manipulation" }}
            >
              {renderTile(id, moving)}
            </li>
          );
        })}
      </ul>

      {dragged && ghost && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[90] h-24 w-28 overflow-hidden rounded-xl shadow-2xl ring-2 ring-accent"
          style={{ left: ghost.x - 56, top: ghost.y - 48, transform: "rotate(-4deg)" }}
        >
          {dragged.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dragged.thumb} alt="" draggable={false} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-black text-xs text-white">Video</span>
          )}
        </div>
      )}
    </div>
  );
}

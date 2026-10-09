"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useScrollRange } from "./useScrollRange";
import { ArrowRight, ChevronDown } from "lucide-react";
import { continentCounts } from "@/lib/countries";
import { stockUrl } from "@/lib/stockPhotos";
import { StockCredit } from "@/components/StockCredit";
import { DEADVLEI, SAMPLE_CODES } from "./content";

const WorldGlobeInner = dynamic(() => import("@/components/WorldGlobeInner").then((m) => m.WorldGlobeInner), {
  ssr: false,
  loading: () => <div className="aspect-[5/4] w-full" />,
});

const PHOTO = stockUrl(DEADVLEI.raw, 2000);

// Where each beat sits along the scene's scroll (0 = top, 1 = released).
const LIGHT_FROM = 0.18;
const LIGHT_TO = 0.55;

/**
 * The opening scene, held on screen while you scroll through it: the
 * headline lifts away and the globe rises; Maya's countries light up one by
 * one; the globe gives way to a photo, and everything outside the word
 * "remembered." fades until the photo lives only inside its letters.
 */
export function HeroScene() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const [lit, setLit] = useState(0);
  useMotionValueEvent(p, "change", (v) => {
    const t = Math.min(1, Math.max(0, (v - LIGHT_FROM) / (LIGHT_TO - LIGHT_FROM)));
    setLit(Math.round(t * SAMPLE_CODES.length));
  });

  // Beat 1 — the headline lifts away as the globe rises into place.
  const titleOpacity = useScrollRange(p, [0, 0.13], [1, 0]);
  const titleY = useScrollRange(p, [0, 0.13], [0, -90]);
  const hintOpacity = useScrollRange(p, [0, 0.05], [1, 0]);
  const globeRise = useScrollRange(p, [0, 0.18], [58, 0]);
  const globeY = useTransform(globeRise, (v) => `${v}vh`);
  // Beat 2 — it holds while the countries light, then rushes toward you.
  const globeScale = useScrollRange(p, [0, 0.18, LIGHT_TO, 0.66], [0.72, 1, 1, 2.4]);
  const globeOpacity = useScrollRange(p, [0.58, 0.66], [1, 0]);
  const captionOpacity = useScrollRange(p, [LIGHT_FROM, 0.24, 0.52, 0.58], [0, 1, 1, 0]);
  // Beat 3 — a photo fills the screen, then shrinks into the word.
  const photoOpacity = useScrollRange(p, [0.58, 0.66, 0.72, 0.86], [0, 1, 1, 0]);
  const lettersOpacity = useScrollRange(p, [0.66, 0.67], [0, 1]);
  const lettersScale = useScrollRange(p, [0.68, 0.88], [3.2, 1]);
  const outroOpacity = useScrollRange(p, [0.84, 0.93], [0, 1]);
  const outroY = useScrollRange(p, [0.84, 0.93], [24, 0]);

  if (reduce) return <StillHero />;

  const shown = SAMPLE_CODES.slice(0, lit);
  const continents = continentCounts(shown).filter((c) => c.visited > 0).length;

  return (
    <section ref={ref} className="relative h-[360vh]" aria-label="ExpandiaX">
      <div className="sticky top-0 h-[100dvh] overflow-hidden">
        <div
          aria-hidden
          className="gradient-travel pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[64rem] -translate-x-1/2 rounded-full opacity-[0.16] blur-3xl dark:opacity-[0.22]"
        />

        {/* Beat 1 */}
        <motion.div
          style={{ opacity: titleOpacity, y: titleY }}
          className="absolute inset-x-0 top-[calc(4.5rem+env(safe-area-inset-top))] z-10 px-5 text-center sm:top-[16vh]"
        >
          <p className="eyebrow">ExpandiaX</p>
          <h1 className="mx-auto mt-4 max-w-4xl text-5xl leading-[1.02] md:text-7xl">
            Every place. <span className="italic text-accent">Every moment.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted">
            The countries you&rsquo;ve explored and the events that made you feel alive - kept in one beautiful archive.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/start" className="btn-accent !px-8 !py-3.5 !text-base font-semibold shadow-lg shadow-accent/25">
              Start my journey <ArrowRight size={17} aria-hidden />
            </Link>
            <Link href="/sign-in" className="btn-ghost !px-6 !py-3">
              Sign in
            </Link>
          </div>
        </motion.div>
        <motion.p
          style={{ opacity: hintOpacity }}
          className="absolute inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] flex flex-col items-center gap-1 text-xs text-muted sm:bottom-10"
          aria-hidden
        >
          Scroll <ChevronDown size={15} className="animate-bounce" />
        </motion.p>

        {/* Beat 2 */}
        <motion.div
          style={{ y: globeY, scale: globeScale, opacity: globeOpacity }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-[min(94vw,78vh)]">
            <WorldGlobeInner visitedCodes={shown} interactive={false} labels={false} autoRotate />
          </div>
        </motion.div>
        <motion.div
          style={{ opacity: captionOpacity }}
          className="absolute inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] text-center sm:bottom-[8vh]"
        >
          <p className="stat-number tabular-nums">
            {shown.length} <span className="text-2xl">{shown.length === 1 ? "country" : "countries"}</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            {continents} continent{continents === 1 ? "" : "s"} · Maya&rsquo;s world, so far
          </p>
        </motion.div>

        {/* Beat 3 */}
        <motion.div style={{ opacity: photoOpacity }} className="absolute inset-0" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PHOTO} alt="" className="h-full w-full object-cover" />
        </motion.div>
        <motion.div style={{ opacity: lettersOpacity }} className="absolute inset-0">
          <PhotoWord word="remembered." scale={lettersScale} />
        </motion.div>
        <motion.div style={{ opacity: outroOpacity, y: outroY }} className="pointer-events-none absolute inset-0">
          <p className="absolute inset-x-0 top-[calc(50%-min(15vw,30vh)*0.62-3.5rem)] text-center font-serif text-4xl md:text-6xl">
            Your life,
          </p>
          <div className="pointer-events-auto absolute inset-x-0 top-[calc(50%+min(15vw,30vh)*0.5)] px-5 text-center">
            <p className="mx-auto max-w-md text-muted">Every country you&rsquo;ve stood in. Every event you never want to forget.</p>
            <Link href="/start" className="btn-accent mt-6 inline-flex !px-8 !py-3.5 !text-base font-semibold shadow-lg shadow-accent/25">
              Start my journey <ArrowRight size={17} aria-hidden />
            </Link>
            <p className="mt-4">
              <StockCredit photo={DEADVLEI} className="!text-muted !drop-shadow-none" />
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/**
 * A word cut out of a photo: the photo stays still and full size while the
 * letters (vector clip-path text, so they stay crisp at any size) scale
 * around it.
 */
function PhotoWord({ word, scale }: { word: string; scale: MotionValue<number> }) {
  const id = useId().replace(/:/g, "");
  const box = useRef<HTMLDivElement>(null);
  const letters = useRef<SVGTextElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cx = size.w / 2;
  const cy = size.h / 2;
  const place = (s: number) => letters.current?.setAttribute("transform", `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`);
  useMotionValueEvent(scale, "change", place);
  useEffect(() => place(scale.get()));

  return (
    <div ref={box} className="absolute inset-0">
      {size.w > 0 && (
        <svg width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} role="img" aria-label={word}>
          <defs>
            {/* A clipPath may hold shapes and text, not groups, so the
                scale goes on the text itself. */}
            <clipPath id={id}>
              <text
                ref={letters}
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="Fraunces, Georgia, serif"
                fontStyle="italic"
                fontSize={Math.min(size.w * 0.15, size.h * 0.3)}
              >
                {word}
              </text>
            </clipPath>
          </defs>
          <image href={PHOTO} x={0} y={0} width={size.w} height={size.h} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`} />
        </svg>
      )}
    </div>
  );
}

/** For reduced motion: the same message, standing still. */
function StillHero() {
  return (
    <section className="relative overflow-hidden px-5 pb-10 pt-16 text-center md:pt-24">
      <p className="eyebrow">ExpandiaX</p>
      <h1 className="mx-auto mt-4 max-w-3xl text-5xl leading-[1.02] md:text-7xl">
        Your life, <span className="italic text-accent">remembered.</span>
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">
        The countries you&rsquo;ve explored and the events that made you feel alive - kept in one beautiful archive.
      </p>
      <Link href="/start" className="btn-accent mt-8 inline-flex !px-8 !py-3.5 !text-base font-semibold">
        Start my journey
      </Link>
      <div className="mx-auto mt-12 max-w-2xl">
        <WorldGlobeInner visitedCodes={SAMPLE_CODES} interactive={false} labels={false} />
      </div>
    </section>
  );
}

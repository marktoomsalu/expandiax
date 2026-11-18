"use client";

import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform, type PanInfo } from "framer-motion";
import { Globe2, MapPin, Music2, PartyPopper, Plane, Ticket, Trophy } from "lucide-react";
import { tapLight } from "@/lib/haptics";
import { Rise } from "./StepTransition";

/**
 * "What do you want to remember?": places on the left, events on the
 * right, side by side. Each card floats gently, follows a finger (tilts
 * toward it, can be nudged and springs back) and opens its path on a tap.
 */
export function ForkStep({ onChoose }: { onChoose: (kind: "country" | "event") => void }) {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(4rem+env(safe-area-inset-top))]">
      <div className="flex flex-1 flex-col justify-center">
        <p className="eyebrow text-center">Step 1</p>
        <h1 className="mt-2 text-center text-3xl md:text-4xl">What do you want to remember?</h1>
        <p className="mt-2 text-center text-sm text-muted">Pick one to start. You can add the other any time.</p>

        <div className="mt-9 grid grid-cols-2 gap-3">
          <Rise delay={0.1}>
            <ChoiceCard
              onChoose={() => onChoose("country")}
              tone="places"
              title="A place I’ve been"
              text="Save the countries and cities you’ve travelled to."
              icon={Globe2}
              floaters={[MapPin, Plane, MapPin]}
              delay={0}
            />
          </Rise>
          <Rise delay={0.22}>
            <ChoiceCard
              onChoose={() => onChoose("event")}
              tone="events"
              title="An event I went to"
              text="Save a concert, festival, sports event or special occasion."
              icon={Ticket}
              floaters={[Music2, Trophy, PartyPopper]}
              delay={0.8}
            />
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

const TONES = {
  places: { bg: "radial-gradient(120% 90% at 20% 10%, #6e1e6a 0%, #2b0b2e 70%)", glow: "rgba(250,81,162,0.35)" },
  events: { bg: "radial-gradient(120% 90% at 80% 10%, #fa51a2 0%, #c2541b 55%, #6e1e2e 100%)", glow: "rgba(251,120,34,0.4)" },
};

function ChoiceCard({
  onChoose,
  tone,
  title,
  text,
  icon: Icon,
  floaters,
  delay,
}: {
  onChoose: () => void;
  tone: keyof typeof TONES;
  title: string;
  text: string;
  icon: typeof Globe2;
  floaters: (typeof Globe2)[];
  delay: number;
}) {
  // Where the finger is over the card (-0.5 … 0.5), for the tilt.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-10, 10]), { stiffness: 220, damping: 18 });
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [8, -8]), { stiffness: 220, damping: 18 });

  function follow(e: React.PointerEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }
  function settle() {
    px.set(0);
    py.set(0);
  }

  return (
    <motion.div
      // A slow float, the two cards out of step with each other.
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay }}
      style={{ perspective: 800 }}
    >
      <motion.button
        type="button"
        drag
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.18}
        onDragEnd={(_: unknown, info: PanInfo) => Math.hypot(info.offset.x, info.offset.y) > 4 && tapLight()}
        onTap={() => {
          tapLight();
          onChoose();
        }}
        onPointerMove={follow}
        onPointerLeave={settle}
        onPointerUp={settle}
        whileTap={{ scale: 0.96 }}
        style={{ rotateX, rotateY, background: TONES[tone].bg, boxShadow: `0 24px 48px -24px ${TONES[tone].glow}` }}
        className="relative flex h-[19rem] w-full touch-none flex-col justify-end overflow-hidden rounded-[1.75rem] p-4 text-left text-white ring-1 ring-white/10 sm:h-[21rem]"
      >
        {/* Little things drifting about the card. */}
        {floaters.map((F, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute text-white/30"
            style={{ left: `${18 + i * 26}%`, top: `${14 + (i % 2) * 16}%` }}
            animate={{ y: [0, -10, 0], rotate: [0, i % 2 ? 8 : -8, 0] }}
            transition={{ duration: 3 + i * 0.7, repeat: Infinity, ease: "easeInOut", delay: delay + i * 0.4 }}
          >
            <F size={18 + (i % 2) * 6} />
          </motion.span>
        ))}
        <span className="mb-auto mt-[38%] flex h-14 w-14 items-center justify-center self-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur">
          <Icon size={26} aria-hidden />
        </span>
        <span className="block font-serif text-xl leading-tight">{title}</span>
        <span className="mt-1.5 block text-[13px] leading-snug text-white/80">{text}</span>
      </motion.button>
    </motion.div>
  );
}

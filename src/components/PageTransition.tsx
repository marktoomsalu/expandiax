"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

// Only an entrance, no exit animation: in the App Router, `children` is the
// router's slot for whatever route is current, so an exiting copy kept on
// screen by AnimatePresence renders the *new* page — mounting it twice. That
// ran every page's mount-time work twice; the first copy used up one-shot
// hand-offs like "I was there" before the visible copy could read them.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const firstRender = useRef(true);
  useEffect(() => {
    firstRender.current = false;
  }, []);

  if (reduce) return <>{children}</>;

  return (
    <motion.div
      key={pathname}
      initial={firstRender.current ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.21, 0.6, 0.35, 1] }}
    >
      {children}
    </motion.div>
  );
}

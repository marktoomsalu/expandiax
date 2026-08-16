"use client";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

// "onPurple" sits on the fixed brand-purple header, which doesn't vary
// with site theme the way "default" contexts (bg-canvas) do — so it gets
// its own fixed-contrast colors instead of the theme-adaptive ones.
export function ThemeToggle({ variant = "default" }: { variant?: "default" | "onPurple" }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="h-9 w-9" aria-hidden />;
  const dark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={
        variant === "onPurple"
          ? "flex h-9 w-9 items-center justify-center rounded-full border border-white/25 text-white/80 transition-colors hover:border-white hover:text-white"
          : "flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-accent hover:text-accent"
      }
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

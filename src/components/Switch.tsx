"use client";

import { cn } from "@/lib/utils";

/** An on/off switch like iPhone's: pink with the knob on the right when on, grey with it on the left when off. */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-60",
        checked ? "bg-accent" : "bg-[#d1d1d6] dark:bg-white/20"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-transform duration-200",
          checked ? "translate-x-[20px]" : "translate-x-0"
        )}
      />
    </button>
  );
}

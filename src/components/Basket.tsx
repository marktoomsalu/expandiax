import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One rounded section of a form ("basket"): an icon, a title and a line of
 * explanation on the left, the controls on the right — stacked on phones.
 */
export function Basket({
  icon: Icon,
  title,
  hint,
  children,
  id,
  className,
  stacked = false,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children: React.ReactNode;
  id?: string;
  className?: string;
  /** Controls under the title at every width (for wide content like a photo grid). */
  stacked?: boolean;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5", className)}>
      <div className={cn("grid gap-3", !stacked && "sm:grid-cols-[minmax(0,13rem)_1fr] sm:gap-5")}>
        <div className="flex items-start gap-3">
          <Icon size={22} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <div className="min-w-0">
            <h2 className="font-serif text-lg leading-tight">{title}</h2>
            {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
          </div>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

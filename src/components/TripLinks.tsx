import { BedDouble, Ticket } from "lucide-react";
import { tripLinks } from "@/lib/partners";
import { cn } from "@/lib/utils";

const ICON = { stays: BedDouble, things: Ticket } as const;

/**
 * "Stays · Things to do" for a place — partner links (Booking.com,
 * GetYourGuide) that open their site. Nothing shows until a partner is set up.
 */
export function TripLinks({ place, size = "small", className }: { place: string; size?: "small" | "large"; className?: string }) {
  const links = tripLinks(place);
  if (!links.length) return null;
  return (
    <span className={cn("flex flex-wrap gap-1.5", className)}>
      {links.map((l) => {
        const Icon = ICON[l.kind];
        return (
          <a
            key={l.kind}
            href={l.url}
            target="_blank"
            rel="sponsored noopener noreferrer"
            aria-label={`${l.label} in ${place} (partner link)`}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-line bg-surface font-medium text-ink transition-colors hover:border-accent hover:text-accent",
              size === "small" ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-2 text-sm"
            )}
          >
            <Icon size={size === "small" ? 12 : 15} className="text-accent" aria-hidden /> {l.label}
          </a>
        );
      })}
    </span>
  );
}

/** Whether any partner links are on — to show the disclosure only when they are. */
export const hasTripLinks = () => tripLinks("x").length > 0;

/** The honest line under partner links. */
export function PartnerNote({ className }: { className?: string }) {
  if (!hasTripLinks()) return null;
  return <p className={cn("text-[11px] text-muted", className)}>Stays and things to do are partner links - ExpandiaX may earn a small commission, at no cost to you.</p>;
}

import Image from "next/image";
import { cn } from "@/lib/utils";

type Face = { id: string; display_name: string; avatar_url: string | null };

/** A few overlapping faces — "these people have been here". */
export function FaceStack({ people, size = 28, max = 3, className }: { people: Face[]; size?: number; max?: number; className?: string }) {
  if (!people.length) return null;
  return (
    <span className={cn("flex", className)} aria-hidden>
      {people.slice(0, max).map((p, i) => (
        <span
          key={p.id}
          className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised font-serif text-xs text-muted ring-2 ring-surface"
          style={{ width: size, height: size, marginLeft: i ? -size / 3 : 0, zIndex: max - i }}
        >
          {p.avatar_url ? <Image src={p.avatar_url} alt="" fill sizes={`${size}px`} className="object-cover" /> : p.display_name.charAt(0)}
        </span>
      ))}
    </span>
  );
}

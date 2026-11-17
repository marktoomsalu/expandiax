import Image from "next/image";
import Link from "next/link";
import type { CollabPerson, Moment } from "@/lib/collab";
import { cn } from "@/lib/utils";

function Face({ p, size = 22 }: { p: CollabPerson; size?: number }) {
  return (
    <span className="relative inline-block shrink-0 overflow-hidden rounded-full bg-raised" style={{ width: size, height: size }}>
      {p.avatar_url ? (
        <Image src={p.avatar_url} alt="" fill sizes={`${size}px`} className="object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-serif text-[11px] text-accent">{p.display_name.slice(0, 1)}</span>
      )}
    </span>
  );
}

const first = (p: CollabPerson) => p.display_name.trim().split(" ")[0];

/**
 * Who was together on this trip or event (migration 078): the person who
 * posted it, and everyone who made their own memory of it, each a tag that
 * opens theirs (their own post and page); and who joined the poster's.
 */
export function MomentPeople({ moment, noun }: { moment: Moment; noun: "trip" | "event" }) {
  const poster = moment.memories.find((m) => !m.own)?.person;
  const ownCount = moment.memories.filter((m) => m.own).length;
  return (
    <section className="mt-6" aria-labelledby="together-h">
      <h2 id="together-h" className="font-serif text-2xl">
        {noun === "trip" ? "Travelled together" : "Went together"}
      </h2>
      {ownCount > 0 && <p className="mt-0.5 text-sm text-muted">Each is their own memory of this {noun}. Tap one to see theirs.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {moment.memories.map((m) => {
          const label = (
            <>
              <Face p={m.person} />
              {first(m.person)}
              {!m.own && <span className={cn("text-[10px] font-semibold uppercase tracking-wide", m.current ? "text-white/70" : "text-muted")}>Posted</span>}
            </>
          );
          const cls = "inline-flex h-10 items-center gap-2 rounded-full pl-1.5 pr-3.5 text-sm font-medium";
          return m.current ? (
            <span key={m.person.id} aria-current="page" className={cn(cls, "bg-brand-purple text-white")}>
              {label}
            </span>
          ) : m.href ? (
            <Link key={m.person.id} href={m.href} className={cn(cls, "border border-line bg-surface hover:border-accent")}>
              {label}
            </Link>
          ) : (
            <span key={m.person.id} title={`${first(m.person)}'s memory is private`} className={cn(cls, "border border-line bg-surface text-muted")}>
              {label}
            </span>
          );
        })}
      </div>
      {moment.joined.length > 0 && poster && (
        <p className="mt-2.5 flex items-center gap-2 text-sm text-muted">
          <span className="flex -space-x-1.5">
            {moment.joined.slice(0, 4).map((p) => (
              <span key={p.id} className="inline-flex rounded-full ring-2 ring-canvas">
                <Face p={p} size={20} />
              </span>
            ))}
          </span>
          <span>
            {moment.joined.length === 1 ? first(moment.joined[0]) : `${moment.joined.slice(0, -1).map(first).join(", ")} and ${first(moment.joined.at(-1)!)}`} joined {first(poster)}&rsquo;s memory
          </span>
        </p>
      )}
    </section>
  );
}

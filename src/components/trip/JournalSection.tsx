import Link from "next/link";
import { BookOpen, Lock, PenLine, Users } from "lucide-react";

/**
 * A trip's journal on its page. Yours: what you wrote (private unless you
 * shared it), or an invitation to start. Someone else's: only when they
 * chose to share it.
 */
export function JournalSection({
  mine,
  editHref,
  theirs,
}: {
  /** The viewer's own journal for this trip (null: nothing written yet). */
  mine?: { body: string; shared: boolean } | null;
  /** Where the viewer writes theirs; without it, no invitation. */
  editHref?: string | null;
  /** A journal its writer shared with whoever can see the trip. */
  theirs?: { body: string; by: string } | null;
}) {
  const own = mine?.body.trim();
  return (
    <>
      {own ? (
        <section className="mt-6 rounded-2xl border border-line bg-surface p-4 sm:p-5" aria-labelledby="journal-h">
          <div className="flex items-center justify-between gap-3">
            <h2 id="journal-h" className="flex items-center gap-2 font-serif text-xl">
              <BookOpen size={18} className="text-accent" aria-hidden /> Your journal
            </h2>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-raised px-2 py-0.5 text-[11px] font-medium text-muted">
              {mine!.shared ? <Users size={11} aria-hidden /> : <Lock size={11} aria-hidden />} {mine!.shared ? "Shared" : "Only you"}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-line font-serif text-[17px] leading-relaxed">{own}</p>
          {editHref && (
            <Link href={editHref} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              <PenLine size={14} aria-hidden /> Keep writing
            </Link>
          )}
        </section>
      ) : (
        editHref && (
          <Link href={editHref} className="mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-4 hover:border-accent">
            <BookOpen size={20} className="shrink-0 text-accent" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Write in your journal</span>
              <span className="block text-xs text-muted">The longer story, just for you. Nobody else reads it unless you share it.</span>
            </span>
          </Link>
        )
      )}
      {theirs?.body.trim() && (
        <section className="mt-6 rounded-2xl border border-line bg-surface p-4 sm:p-5" aria-labelledby="their-journal-h">
          <h2 id="their-journal-h" className="flex items-center gap-2 font-serif text-xl">
            <BookOpen size={18} className="text-accent" aria-hidden /> {theirs.by ? `${theirs.by}'s journal` : "Journal"}
          </h2>
          <p className="mt-3 whitespace-pre-line font-serif text-[17px] leading-relaxed">{theirs.body.trim()}</p>
        </section>
      )}
    </>
  );
}

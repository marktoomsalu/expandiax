import Image from "next/image";

/**
 * An invitation to a trip or event that feels like someone sharing a memory
 * with you: its cover, blurred (the photos are yours to see once you're
 * in), whose it is, where and when, and what to do. `children`: the way in
 * ("Unlock this memory", or the choice of how it goes on your profile).
 */
export function MomentInviteCard({
  cover,
  inviter,
  inviterAvatar,
  title,
  when,
  place,
  photos,
  flag,
  children,
}: {
  cover: string | null;
  inviter: string;
  inviterAvatar?: string | null;
  title: string;
  when: string;
  place?: string;
  photos?: number;
  flag?: string;
  children?: React.ReactNode;
}) {
  const first = inviter.trim().split(" ")[0] || "Someone";
  return (
    <div className="overflow-hidden rounded-3xl bg-brand-purple text-white shadow-xl shadow-black/20 ring-1 ring-white/10">
      <div className="relative h-60 overflow-hidden">
        {cover ? (
          <Image src={cover} alt="" fill sizes="(min-width: 640px) 480px, 100vw" className="scale-110 object-cover blur-[14px] brightness-90" />
        ) : (
          <span aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 30% 20%, #fa51a2 0%, #6e1e6a 45%, #2b0b2e 100%)" }} />
        )}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-[#2b0b2e]" />
        <div className="absolute inset-x-0 top-0 flex items-center gap-2.5 p-4">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 font-serif text-lg ring-2 ring-white/70">
            {inviterAvatar ? <Image src={inviterAvatar} alt="" fill sizes="40px" className="object-cover" /> : first.charAt(0)}
          </span>
          <span className="text-sm font-medium drop-shadow">{first} wants to share a memory with you 💌</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/75">You were part of this memory 🌍</p>
          <p className="mt-1 font-serif text-[2rem] leading-[1.05] drop-shadow-md">
            {flag && <span className="mr-2 text-[0.8em]" aria-hidden>{flag}</span>}
            {title}
          </p>
          <p className="mt-1 text-sm text-white/85">
            {[when, place].filter(Boolean).join(" · ")}
            {photos ? ` · ${photos} ${photos === 1 ? "photo" : "photos"} waiting` : ""}
          </p>
        </div>
      </div>
      {children && <div className="p-4 pt-3">{children}</div>}
    </div>
  );
}

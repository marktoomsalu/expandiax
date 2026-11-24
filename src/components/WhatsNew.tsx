"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, ShieldCheck, Sparkles, Ticket, Wand2 } from "lucide-react";
import { hasGlobeTouch, phoneWord } from "@/lib/globeTouch";
import { featuresReleased, findReleasedFor, joinedBeforeFeatures } from "@/lib/appVersion";
import { canScanPhotos } from "@/lib/photoScan";
import { fromPhotosSeen } from "@/lib/memoryFinder";
import { TOUR, claimIntro, markTourSeen, releaseIntro, tourSeen } from "@/lib/introQueue";
import { tapLight } from "@/lib/haptics";

const QUIET = ["/touch", "/start", "/sign-in", "/sign-up", "/onboarding", "/join"];

/**
 * Once, for people who were here before (not new members, for whom nothing
 * is new), when the version is out on the App Store:
 *   in the 1.2 app: Discover my world, the automatic memory finder, and only
 *   that (1.1's Chat and World Connect tour isn't shown there);
 *   in the 1.1 app: Chat and World Connect, then the chat tour and the World
 *   Connect card (lib/introQueue TOUR).
 */
export function WhatsNew({ joinedAt, preview = false }: { joinedAt: string; preview?: boolean }) {
  const path = usePathname();
  const router = useRouter();
  // `preview`: 1.2's sheet, open (design previews only).
  const [open, setOpen] = useState(preview);
  const [finder, setFinder] = useState(preview);

  useEffect(() => {
    if (preview || QUIET.some((p) => path.startsWith(p))) return;
    // The 1.2 app: Discover my world, unless they've already used it.
    if (canScanPhotos()) {
      if (tourSeen(TOUR.find)) return;
      if (fromPhotosSeen()) return markTourSeen(TOUR.find);
      if (!claimIntro("whats-new")) return;
      let alive = true;
      void findReleasedFor(joinedAt).then((out) => {
        if (!alive) return;
        if (out) {
          setFinder(true);
          setOpen(true);
        } else releaseIntro("whats-new");
      });
      return () => {
        alive = false;
      };
    }
    if (!hasGlobeTouch() || !joinedBeforeFeatures(joinedAt)) return;
    if (tourSeen(TOUR.whatsNew)) return;
    // Hold the other welcome cards back while we find out.
    if (!claimIntro("whats-new")) return;
    let alive = true;
    void featuresReleased().then((out) => {
      if (!alive) return;
      if (out) setOpen(true);
      else releaseIntro("whats-new");
    });
    return () => {
      alive = false;
    };
    // Once per app start (and when leaving a quiet screen).
  }, [path.startsWith("/start") || path.startsWith("/sign")]); // eslint-disable-line react-hooks/exhaustive-deps

  function close() {
    tapLight();
    setOpen(false);
    releaseIntro("whats-new");
    if (finder) return markTourSeen(TOUR.find);
    // Next: the chat tour, then World Connect.
    markTourSeen(TOUR.whatsNew);
  }

  if (!open) return null;
  const feature = (Icon: typeof MessageCircle, title: string, text: string, from: string, to: string) => (
    <li className="flex gap-4 text-left">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }} aria-hidden>
        <Icon size={22} />
      </span>
      <span>
        <span className="block font-serif text-xl">{title}</span>
        <span className="mt-0.5 block text-sm text-white/75">{text}</span>
      </span>
    </li>
  );

  if (finder)
    return (
      <div className="fixed inset-0 z-[96] flex items-end justify-center bg-[rgba(10,2,14,0.74)]" role="dialog" aria-modal="true" aria-labelledby="whats-new-h">
        <div
          className="w-full max-w-md rounded-t-[28px] px-6 pt-7 text-white sm:mb-6 sm:rounded-[28px]"
          style={{ background: "radial-gradient(120% 90% at 50% 0%, #4a1450 0%, #2b0b2e 55%, #12041a 100%)", paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
        >
          <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
            <Sparkles size={13} aria-hidden /> New in ExpandiaX
          </p>
          <h2 id="whats-new-h" className="mt-2 text-center font-serif text-3xl leading-tight">
            Discover <span className="italic text-[#ff8cc6]">my world</span>
          </h2>
          <p className="mt-1.5 text-center text-sm text-white/70">Your automatic memory finder</p>
          <ul className="mt-6 space-y-5">
            {feature(Wand2, "It finds them for you", "Countries, trips and their dates, found automatically from when and where your photos were taken.", "#fa51a2", "#fb7822")}
            {feature(Ticket, "Your moments, too", "Concerts, matches and festivals you were at, back with their photos.", "#7c1d6f", "#fa51a2")}
            {feature(ShieldCheck, "Private by design", "Read on your phone, nothing uploaded. You choose what's kept.", "#4a1450", "#7c1d6f")}
          </ul>
          <button
            type="button"
            onClick={() => {
              close();
              router.push("/my-world/find-trips");
            }}
            className="mt-7 w-full rounded-full py-4 text-lg font-bold text-[#2b0b2e]"
            style={{ background: "linear-gradient(90deg, #fa51a2, #fb7822)" }}
          >
            Discover my world
          </button>
          <button type="button" onClick={close} className="mt-2 w-full py-2.5 text-sm font-medium text-white/65 hover:text-white">
            Maybe later
          </button>
        </div>
      </div>
    );

  return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center bg-[rgba(10,2,14,0.74)]" role="dialog" aria-modal="true" aria-labelledby="whats-new-h">
      <div
        className="w-full max-w-md rounded-t-[28px] px-6 pt-7 text-white sm:mb-6 sm:rounded-[28px]"
        style={{ background: "radial-gradient(120% 90% at 50% 0%, #4a1450 0%, #2b0b2e 55%, #12041a 100%)", paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
          <Sparkles size={13} aria-hidden /> New in ExpandiaX
        </p>
        <h2 id="whats-new-h" className="mt-2 text-center font-serif text-3xl leading-tight">
          Two new ways to connect
        </h2>
        <ul className="mt-6 space-y-5">
          {feature(MessageCircle, "Chat", "Write to friends any time, or send anyone a postcard about a place they’ve been. Your chats live in the bubble in the corner.", "#fa51a2", "#fb7822")}
          {feature(Sparkles, "World Connect", `Hold your ${phoneWord()} close to a friend’s: see the countries you share, and follow each other in a second.`, "#7c1d6f", "#fa51a2")}
        </ul>
        <button
          type="button"
          onClick={close}
          className="mt-7 w-full rounded-full py-4 text-lg font-bold text-[#2b0b2e]"
          style={{ background: "linear-gradient(90deg, #fa51a2, #fb7822)" }}
        >
          Let&rsquo;s go
        </button>
      </div>
    </div>
  );
}

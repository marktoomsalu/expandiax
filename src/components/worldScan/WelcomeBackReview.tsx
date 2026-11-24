"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import { tapLight, tapSuccess } from "@/lib/haptics";
import { chosenWorld, clearKeptWorld, loadKeptWorld, loadMemberWorld, saveWorld, worldNews, type KeptEvent, type KeptTrip, type KeptWorld, type MemberWorld, type WorldNews } from "@/lib/worldScan";

const TYPE_EMOJI: Record<string, string> = { concert: "🎤", festival: "🎪", sport: "🏟️", conference: "🎟️", personal: "💛", other: "✨" };

const day = (iso: string, year = true) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
const span = (from: string, to: string) => (from === to ? day(from) : from.slice(0, 4) === to.slice(0, 4) ? `${day(from, false)} – ${day(to)}` : `${day(from)} – ${day(to)}`);
const name = (code: string) => `${countryByCode(code)?.flag ?? ""} ${countryByCode(code)?.name ?? code}`.trim();

function Tick({ on }: { on: boolean }) {
  return (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${on ? "gradient-travel text-white" : "ring-1 ring-white/35"}`} aria-hidden>
      {on && <Check size={14} strokeWidth={3} />}
    </span>
  );
}

/**
 * Back with an account already: someone who went through Find my world
 * again and signed up with an account they have (Apple or Google sign them
 * in; email sends them to sign in). Nothing was saved into the account; on
 * My World, what their photos found that isn't there yet is shown to pick
 * from (what's already there is left out and counted), and only what they
 * pick is added, with nothing saved twice and their home left as it is.
 */
/** `demo`: a made-up world and member, for design previews (nothing loaded or saved). */
export function WelcomeBackReview({ userId, firstName, demo }: { userId: string; firstName: string | null; demo?: { world: KeptWorld; mine: MemberWorld } }) {
  const router = useRouter();
  const [world, setWorld] = useState<KeptWorld | null>(null);
  const [news, setNews] = useState<WorldNews | null>(null);
  const [countries, setCountries] = useState<Set<string>>(new Set());
  const [trips, setTrips] = useState<Set<KeptTrip>>(new Set());
  const [events, setEvents] = useState<Set<KeptEvent>>(new Set());
  const [state, setState] = useState<"review" | "saving" | "done">("review");
  const [added, setAdded] = useState<{ countries: number; trips: number; events: number } | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const kept = demo?.world ?? loadKeptWorld();
    if (!kept) return;
    setWorld(kept);
    void (demo ? Promise.resolve(demo.mine) : loadMemberWorld(userId, kept))
      .then((mine) => {
        const n = worldNews(kept, mine);
        setNews(n);
        setCountries(new Set(n.countries));
        setTrips(new Set(n.trips));
        setEvents(new Set(n.events));
      })
      .catch(() => setNews({ countries: [], trips: [], events: [], known: { countries: 0, trips: 0, events: 0 } }));
  }, [userId, demo]);

  const count = useMemo(() => countries.size + trips.size + events.size, [countries, trips, events]);
  if (!world || !news || !open) return null;
  const nothing = news.countries.length + news.trips.length + news.events.length === 0;
  const isNew = (code: string) => news.countries.includes(code);

  // A country off takes its trips and memories with it; a trip or memory on brings its (new) country.
  const toggleCountry = (code: string) => {
    tapLight();
    const on = !countries.has(code);
    setCountries((s) => new Set(on ? [...s, code] : [...s].filter((c) => c !== code)));
    if (!on) {
      setTrips((s) => new Set([...s].filter((t) => t.code !== code)));
      setEvents((s) => new Set([...s].filter((e) => e.code !== code)));
    }
  };
  const toggle = <T extends { code: string }>(set: Set<T>, put: (s: Set<T>) => void, item: T) => {
    tapLight();
    const next = new Set(set);
    if (next.has(item)) next.delete(item);
    else {
      next.add(item);
      if (isNew(item.code) && !countries.has(item.code)) setCountries((s) => new Set([...s, item.code]));
    }
    put(next);
  };

  const close = () => {
    clearKeptWorld();
    setOpen(false);
  };

  async function add() {
    setState("saving");
    const result = await saveWorld(userId, chosenWorld(news!, { countries, trips, events })).catch(() => null);
    clearKeptWorld();
    tapSuccess();
    setAdded(result ?? { countries: 0, trips: 0, events: 0 });
    setState("done");
    router.refresh();
  }

  const known = news.known;
  const knownLine = [
    known.countries && `${known.countries} ${known.countries === 1 ? "country" : "countries"}`,
    known.trips && `${known.trips} ${known.trips === 1 ? "trip" : "trips"}`,
    known.events && `${known.events} ${known.events === 1 ? "memory" : "memories"}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[85] overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_50%_20%,#5a1758_0%,#2b0b2e_55%,#14051a_100%)] text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))]">
          {state === "done" ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <span className="gradient-travel flex h-20 w-20 items-center justify-center rounded-full shadow-[0_14px_40px_-10px_rgba(250,81,162,0.8)]">
                <Check size={38} strokeWidth={2.5} aria-hidden />
              </span>
              <h1 className="mt-6 font-serif text-[2.2rem] leading-tight">Added to your world.</h1>
              <p className="mt-2 text-white/70">
                {[
                  added?.countries && `${added.countries} new ${added.countries === 1 ? "country" : "countries"}`,
                  added?.trips && `${added.trips} ${added.trips === 1 ? "trip" : "trips"}`,
                  added?.events && `${added.events} ${added.events === 1 ? "memory" : "memories"}`,
                ]
                  .filter(Boolean)
                  .join(", ") || "All set."}
              </p>
            </div>
          ) : (
            <>
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-[#ff8cc6]">Welcome back</p>
              <h1 className="mt-2 text-center font-serif text-[2.1rem] leading-[1.1]">
                {firstName ? `${firstName}, you're` : "You're"} <span className="italic text-[#ff8cc6]">already one of us.</span>
              </h1>
              <p className="mx-auto mt-3 max-w-xs text-center text-[15px] leading-snug text-white/70">
                {nothing
                  ? "Everything your photos found is already in your world. Nothing was changed."
                  : "Nothing in your account was changed. Here's what your photos found that isn't in your world yet: pick what to add."}
              </p>

              {news.countries.length > 0 && (
                <section className="mt-7">
                  <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-white/55">New countries</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {news.countries.map((code) => {
                      const on = countries.has(code);
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => toggleCountry(code)}
                          aria-pressed={on}
                          className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition ${on ? "bg-white text-[#2b0b2e]" : "bg-white/[0.07] text-white/60 ring-1 ring-white/15"}`}
                        >
                          {on && <Check size={14} strokeWidth={3} className="text-[#fa51a2]" aria-hidden />}
                          {name(code)}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {news.trips.length > 0 && (
                <section className="mt-7">
                  <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-white/55">New trips</h2>
                  <ul className="mt-2 divide-y divide-white/10 rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
                    {news.trips.map((t) => (
                      <li key={`${t.code}-${t.from}`}>
                        <button type="button" onClick={() => toggle(trips, setTrips, t)} aria-pressed={trips.has(t)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-medium">{name(t.code)}</span>
                            <span className="block text-xs text-white/55">
                              {span(t.from, t.to)}
                              {t.towns?.length ? ` · ${t.towns.slice(0, 2).map((x) => x.name).join(", ")}` : ""}
                            </span>
                          </span>
                          <Tick on={trips.has(t)} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {news.events.length > 0 && (
                <section className="mt-7">
                  <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-white/55">New memories</h2>
                  <ul className="mt-2 divide-y divide-white/10 rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
                    {news.events.map((e) => (
                      <li key={`${e.date}-${e.title}`}>
                        <button type="button" onClick={() => toggle(events, setEvents, e)} aria-pressed={events.has(e)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                          <span className="text-xl" aria-hidden>
                            {TYPE_EMOJI[e.type] ?? "✨"}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-medium">{e.artist || e.title}</span>
                            <span className="block truncate text-xs text-white/55">
                              {[e.venue, e.city].filter(Boolean).join(", ") || name(e.code)} · {day(e.date)}
                            </span>
                          </span>
                          <Tick on={events.has(e)} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {knownLine && (
                <p className="mt-6 flex items-start gap-2 rounded-2xl bg-white/[0.05] px-4 py-3 text-[13px] leading-snug text-white/60 ring-1 ring-white/10">
                  <Check size={15} className="mt-0.5 shrink-0 text-[#ffb3d6]" aria-hidden />
                  <span>
                    Already in your world, so left out: <span className="text-white/85">{knownLine}</span>.
                  </span>
                </p>
              )}
            </>
          )}
        </div>

        {/* The way on, always in reach. */}
        <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#14051a] via-[#14051a]/95 to-transparent px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6">
          <div className="mx-auto max-w-md space-y-2.5 text-center">
            {state === "done" || nothing ? (
              <button type="button" onClick={close} className="btn-accent w-full py-4 text-lg">
                See my world
              </button>
            ) : (
              <>
                <button type="button" onClick={() => void add()} disabled={count === 0 || state === "saving"} className="btn-accent flex w-full items-center justify-center gap-2 py-4 text-lg disabled:opacity-50">
                  {state === "saving" ? <Loader2 size={20} className="animate-spin" aria-hidden /> : null}
                  {state === "saving" ? "Adding…" : count === 0 ? "Pick something to add" : "Add to my world"}
                </button>
                <button type="button" onClick={close} disabled={state === "saving"} className="w-full py-2 text-sm font-medium text-white/65 hover:text-white">
                  Skip, keep my world as it is
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

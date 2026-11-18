/**
 * Next Step: on every visit, the one most valuable thing this member could
 * do next, or nothing. Decided from what they've actually done (never from
 * how long they've been here), so it works the same for someone who signed
 * up a minute ago and for someone who's been here a year.
 *
 *   signals → stage → moments this stage allows (done ones drop out)
 *           → rules ("Not now" = 7 days, 3 = retired, a pause) → rank → one
 *
 * Pure: the data comes in (nextStepData.ts), the choice comes out, so every
 * rule is testable.
 */

export type Stage = 0 | 1 | 2 | 3 | 4;
export const STAGE_NAMES: Record<Stage, string> = { 0: "Arrived", 1: "Collector", 2: "Storyteller", 3: "Connected", 4: "Network" };

/** A trip, a stay or an event: something with a date that photos belong to. */
export type MemorySignal = {
  kind: "trip" | "event";
  id: string;
  /** "Italy", "Taylor Swift" */
  label: string;
  countryCode: string;
  countryName: string;
  date: string;
  photos: number;
  isStay?: boolean;
  hasSong: boolean;
  /** A quick memory, a review or captions: their own words on it. */
  hasWords: boolean;
  hasJournal: boolean;
  /** People added to it (Who was with you?). */
  people: number;
  /** Concerts: the artist, for their past shows. */
  artist?: string | null;
  /** "Not adding photos" was chosen for it. */
  reminderOff?: boolean;
};

export type CountrySignal = {
  code: string;
  name: string;
  photos: number;
  /** The latest trip there, if there is one. */
  latestTripId: string | null;
  reminderOff: boolean;
  addedAt: string;
};

export type Signals = {
  countries: CountrySignal[];
  memories: MemorySignal[];
  following: number;
  mutuals: number;
  /** People on any of their memories, or memories they're on. */
  peopleLinked: number;
  dreams: number;
  worldConnects: number;
  hasRealName: boolean;
};

export type MomentHistory = { shown?: number; lastShown?: string; taken?: string; dismissed?: number; dismissedAt?: string };
export type History = { stage: number; moments: Record<string, MomentHistory>; pausedUntil: string | null };

export type Screen = "my-world" | "feed";

export type Chip = { label: string; href: string };
export type NextStep = {
  id: string;
  icon: "camera" | "ticket" | "globe" | "map" | "music" | "book" | "users" | "user" | "star" | "compass" | "handshake";
  title: string;
  body: string;
  cta: { label: string; href: string };
  chips?: Chip[];
  /** Photos: the photo reminders on the same screen say the same thing, so they step aside. */
  aboutPhotos?: boolean;
};

const DAY = 86_400_000;
const NOT_NOW_DAYS = 7;
const TRY_AGAIN_DAYS = 3;

/* ------------------------------------------------------------------ */
/* Stage                                                               */
/* ------------------------------------------------------------------ */

/** Where they are now, from what they've done. Each stage needs the one before. */
export function workOutStage(s: Signals): Stage {
  const withPhotos = s.memories.filter((m) => m.photos > 0);
  const events = s.memories.filter((m) => m.kind === "event").length;
  if (!withPhotos.length) return 0;
  // A world that grows: three memories, or a map plus an event.
  if (!(s.memories.length >= 3 || (s.countries.length >= 5 && events >= 1))) return 1;
  // One rich story: photos plus a song or their own words.
  if (!withPhotos.some((m) => m.hasSong || m.hasWords || m.hasJournal)) return 2;
  // Their first people.
  if (!(s.following >= 3 || s.peopleLinked >= 1)) return 3;
  return 4;
}

/** Stages only go forward: what they reached before stays reached. */
export function currentStage(s: Signals, h: History): Stage {
  return Math.max(workOutStage(s), Math.min(Math.max(h.stage, 0), 4)) as Stage;
}

/* ------------------------------------------------------------------ */
/* Moments                                                             */
/* ------------------------------------------------------------------ */

type Candidate = NextStep & {
  /** How far it moves them toward their next aha, 1–10. */
  value: number;
  /** 1 a tap · 2 a few minutes · 3 some writing. */
  effort: 1 | 2 | 3;
  /** Doing it takes them to the next stage. */
  advances?: boolean;
};

type MomentDef = {
  id: string;
  minStage: Stage;
  maxStage?: Stage;
  /** "Not now" this many times and it's gone for good (default 3). */
  retireAfter?: number;
  screens?: Screen[];
  build: (s: Signals, stage: Stage) => Omit<Candidate, "id"> | null;
};

const lower = (code: string) => code.toLowerCase();
const tripEdit = (m: MemorySignal, anchor: string) => `/my-world/${lower(m.countryCode)}/visits/${m.id}/edit#${anchor}`;
const eventEdit = (m: MemorySignal, anchor: string) => `/events/${m.id}/edit#${anchor}`;
const editOf = (m: MemorySignal, anchor: string) => (m.kind === "trip" ? tripEdit(m, anchor) : eventEdit(m, anchor));
const countryPhotosHref = (c: CountrySignal) =>
  c.latestTripId ? `/my-world/${lower(c.code)}/visits/${c.latestTripId}/edit#photos` : `/my-world/${lower(c.code)}#add`;
const newestFirst = <T extends { date: string }>(list: T[]) => [...list].sort((a, b) => b.date.localeCompare(a.date));
const mostPhotos = (list: MemorySignal[]) => [...list].sort((a, b) => b.photos - a.photos || b.date.localeCompare(a.date));
const trips = (s: Signals) => s.memories.filter((m) => m.kind === "trip");
const eventsOf = (s: Signals) => s.memories.filter((m) => m.kind === "event");

export const MOMENTS: MomentDef[] = [
  {
    // Aha 1: a pin becomes a memory.
    id: "first-photos",
    minStage: 0,
    maxStage: 0,
    retireAfter: 1, // no photos at all (privacy, a new phone): stop asking
    build: (s) => {
      const waiting = s.countries.filter((c) => c.photos === 0 && !c.reminderOff);
      if (!waiting.length) return null;
      const chips = [...waiting].sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, 6).map((c) => ({ label: c.name, href: countryPhotosHref(c) }));
      if (waiting.length === 1) {
        const c = waiting[0];
        return {
          icon: "camera",
          title: `${c.name}, in photos`,
          body: "Add a few from your phone. We'll read when and where they were taken.",
          cta: { label: "Add photos", href: countryPhotosHref(c) },
          aboutPhotos: true,
          value: 10,
          effort: 2,
          advances: true,
        };
      }
      return {
        icon: "camera",
        title: "Which of these has the best photos on your phone?",
        body: "Start there. A country with photos turns from a pin into a memory.",
        cta: { label: `Start with ${chips[0].label}`, href: chips[0].href },
        chips,
        aboutPhotos: true,
        value: 10,
        effort: 2,
        advances: true,
      };
    },
  },
  {
    // A complete event, not one photo.
    id: "finish-night",
    minStage: 0,
    build: (s, stage) => {
      const e = newestFirst(eventsOf(s).filter((m) => m.photos <= 1 && !m.reminderOff))[0];
      if (!e) return null;
      // Not "that night": a match, a wedding or a festival day isn't one.
      return {
        icon: "camera",
        title: e.photos === 0 ? `${e.label}, in photos` : `More from ${e.label}?`,
        body: e.photos === 0 ? "Add your photos and videos from it. They're what bring it back." : "Add the rest of your photos and videos, so it's all in one place.",
        cta: { label: "Add photos", href: eventEdit(e, "photos") },
        aboutPhotos: true,
        value: e.photos === 0 ? 9 : 6,
        effort: 2,
        advances: stage === 0 && e.photos === 0,
      };
    },
  },
  {
    // The fastest delight in the app: a world lighting up.
    id: "light-up-map",
    minStage: 0,
    retireAfter: 1, // only ever events, never travels: leave the map be
    build: (s) =>
      s.countries.length >= 2
        ? null
        : {
            icon: "globe",
            title: "Where else have you been?",
            body: "Tap the countries on a map. It takes 30 seconds.",
            cta: { label: "Light up my map", href: "/my-world/light-up" },
            value: 7,
            effort: 1,
          },
  },
  {
    // Places become stories.
    id: "country-into-trip",
    minStage: 1,
    build: (s, stage) => {
      const bare = s.countries.filter((c) => !c.latestTripId && !c.reminderOff).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
      if (!bare.length) return null;
      const advances = stage === 1 && s.memories.length === 2;
      if (!trips(s).length) {
        // Came in through an event: the first trip, from whichever has the best photos.
        const chips = bare.slice(0, 6).map((c) => ({ label: c.name, href: `/my-world/${lower(c.code)}#add` }));
        return {
          icon: "map",
          title: "Turn one of your countries into a trip",
          body: "Start with the one with the best photos on your phone.",
          cta: { label: `Start with ${chips[0].label}`, href: chips[0].href },
          chips: chips.length > 1 ? chips : undefined,
          value: 6,
          effort: 2,
          advances,
        };
      }
      const c = bare[0];
      return {
        icon: "map",
        title: `Turn ${c.name} into a trip`,
        body: "A few photos and its dates, and it's a memory, not just a pin.",
        cta: { label: "Start the trip", href: `/my-world/${lower(c.code)}#add` },
        value: 5,
        effort: 2,
        advances,
      };
    },
  },
  {
    // The other half of ExpandiaX, through a memory they already have.
    id: "other-half",
    minStage: 1,
    build: (s, stage) => {
      if (s.memories.length < 2 || eventsOf(s).length > 0) return null;
      const latest = newestFirst(trips(s))[0];
      if (!latest) return null;
      return {
        icon: "ticket",
        title: `Anything unforgettable in ${latest.countryName}?`,
        body: "A concert, a match, a wedding: keep the nights that mattered too.",
        cta: { label: "Add an event", href: "/events/new" },
        value: 7,
        effort: 2,
        advances: stage === 1,
      };
    },
  },
  {
    // The next event in one tap.
    id: "past-shows",
    minStage: 1,
    build: (s) => {
      const byArtist = new Map<string, number>();
      for (const e of eventsOf(s)) if (e.artist) byArtist.set(e.artist, (byArtist.get(e.artist) ?? 0) + 1);
      const once = newestFirst(eventsOf(s).filter((e) => e.artist && byArtist.get(e.artist) === 1))[0];
      if (!once?.artist) return null;
      return {
        icon: "ticket",
        title: `Seen ${once.artist} more than once?`,
        body: "Pick from their past shows and it's added in a tap.",
        cta: { label: "See past shows", href: "/events/new" },
        value: 4,
        effort: 1,
      };
    },
  },
  {
    // The memory feels alive when it's opened.
    id: "its-song",
    minStage: 2,
    build: (s, stage) => {
      const m = mostPhotos(s.memories.filter((x) => x.photos >= 5 && !x.hasSong))[0];
      if (!m) return null;
      return {
        icon: "music",
        title: `Give ${m.label} its song`,
        body: "The one that takes you back. It plays when friends open it.",
        cta: { label: "Pick the song", href: editOf(m, "song") },
        value: 6,
        effort: 1,
        advances: stage === 2,
      };
    },
  },
  {
    // Their own words, privately.
    id: "longer-story",
    minStage: 2,
    build: (s, stage) => {
      const m = mostPhotos(trips(s).filter((x) => (x.photos >= 10 || x.isStay) && !x.hasJournal))[0];
      if (!m) return null;
      return {
        icon: "book",
        title: m.isStay ? `Your time in ${m.label}, in your words` : `Write the longer story of ${m.label}`,
        body: "Only you will read it, unless you choose to share it.",
        cta: { label: "Start writing", href: tripEdit(m, "journal") },
        value: 5,
        effort: 3,
        advances: stage === 2,
      };
    },
  },
  {
    // The first social step, as part of a memory, not "add friends".
    id: "who-was-with-you",
    minStage: 2,
    build: (s, stage) => {
      const m = mostPhotos(s.memories.filter((x) => x.photos > 0 && x.people === 0 && !x.isStay))[0];
      if (!m) return null;
      return {
        icon: "users",
        title: m.kind === "trip" ? `Who was with you in ${m.label}?` : `Who went with you to ${m.label}?`,
        body: "Add them: their photos can join yours, and it's on their map too.",
        cta: { label: "Add who was there", href: editOf(m, "collaborators") },
        value: 7,
        effort: 1,
        advances: stage === 3,
      };
    },
  },
  {
    id: "add-name",
    minStage: 1,
    build: (s) =>
      s.hasRealName
        ? null
        : {
            icon: "user",
            title: "What should friends call you?",
            body: "Your profile says “Traveller” for now.",
            cta: { label: "Add your name", href: "/settings" },
            value: 5,
            effort: 1,
          },
  },
  {
    // A feed worth opening.
    id: "find-people",
    minStage: 3,
    retireAfter: 1, // following nobody on purpose is fine
    screens: ["my-world"], // the empty feed already says it
    build: (s, stage) =>
      s.following >= 3
        ? null
        : {
            icon: "users",
            title: "Find people you know",
            body: "Or bring them with a link: you'll follow each other when they join.",
            cta: { label: "Find friends", href: "/feed?friends=1" },
            value: 8,
            effort: 1,
            advances: stage === 3,
          },
  },
  {
    // A reason to plan with ExpandiaX.
    id: "where-next",
    minStage: 2,
    build: (s) =>
      s.countries.length < 10 || s.dreams > 0
        ? null
        : {
            icon: "compass",
            title: "Where next?",
            body: "Add a place you dream of, and see who you follow has been.",
            cta: { label: "Explore places", href: "/explore" },
            value: 4,
            effort: 1,
          },
  },
  {
    // New people, met in real life.
    id: "world-connect",
    minStage: 4,
    build: (s) =>
      s.mutuals < 5 || s.worldConnects > 0
        ? null
        : {
            icon: "handshake",
            title: "Met someone on a trip?",
            body: "Connect your worlds in a tap and see where you've both been.",
            cta: { label: "Try World Connect", href: "/touch" },
            value: 4,
            effort: 1,
          },
  },
];

/* ------------------------------------------------------------------ */
/* Rules and ranking                                                   */
/* ------------------------------------------------------------------ */

/** Why a moment can't show right now, or null if it can. */
export function heldBack(def: Pick<MomentDef, "id" | "retireAfter">, h: History, now: Date): string | null {
  const m = h.moments[def.id];
  if (!m) return null;
  if ((m.dismissed ?? 0) >= (def.retireAfter ?? 3)) return "retired";
  if (m.dismissedAt && now.getTime() - Date.parse(m.dismissedAt) < NOT_NOW_DAYS * DAY) return "not now";
  // Tapped but not done yet: give it a few days before asking again.
  if (m.taken && now.getTime() - Date.parse(m.taken) < TRY_AGAIN_DAYS * DAY) return "taken";
  return null;
}

export function score(c: Pick<Candidate, "value" | "effort" | "advances">): number {
  return c.value * 10 - c.effort * 5 + (c.advances ? 25 : 0);
}

/**
 * The one thing to show on this screen, or null. Null is a good answer:
 * paused, or nothing left that's worth their time.
 */
export function pickNextStep(s: Signals, h: History, opts: { screen: Screen; now?: Date }): { stage: Stage; step: NextStep | null } {
  const now = opts.now ?? new Date();
  const stage = currentStage(s, h);
  if (h.pausedUntil && Date.parse(h.pausedUntil) > now.getTime()) return { stage, step: null };

  let best: { c: Candidate; score: number } | null = null;
  for (const def of MOMENTS) {
    if (stage < def.minStage || (def.maxStage !== undefined && stage > def.maxStage)) continue;
    if (def.screens && !def.screens.includes(opts.screen)) continue;
    if (heldBack(def, h, now)) continue;
    const built = def.build(s, stage);
    if (!built) continue;
    const c = { ...built, id: def.id };
    const sc = score(c);
    if (!best || sc > best.score) best = { c, score: sc };
  }
  if (!best) return { stage, step: null };
  const { id, icon, title, body, cta, chips, aboutPhotos } = best.c;
  return { stage, step: { id, icon, title, body, cta, chips, aboutPhotos } };
}

/**
 * Chapter One: the eight things every new member does to make ExpandiaX
 * theirs, told as the first chapter of their story. Done in any order;
 * each ticks itself off from what they've actually done (the database's
 * first_chapter(), migration 083), and the last one unlocks the badge.
 */

export type StepId = "introduce" | "map" | "trip" | "event" | "song" | "people" | "together" | "hello";

export type ChapterFacts = {
  steps: Record<StepId, boolean>;
  countries: number;
  following: number;
  latestCountry: string | null;
  trip: { id: string; code: string } | null;
  event: string | null;
  finishedAt: string | null;
};

export type StepAction = { label: string; href: string } | { label: string; openChat: true };

export type JourneyStep = {
  id: StepId;
  /** Shown on the path: "Light up your map". */
  title: string;
  /** The story line: why it matters to them. */
  story: string;
  /** Said once it's done. */
  doneLine: string;
  icon: "user" | "globe" | "camera" | "ticket" | "music" | "users" | "handshake" | "chat";
  done: boolean;
  /** "1 of 3 countries" while it's under way. */
  progress?: string;
  action: StepAction;
};

export type Journey = { steps: JourneyStep[]; done: number; total: number; finished: boolean; next: JourneyStep | null };

const lower = (s: string) => s.toLowerCase();

export function buildJourney(f: ChapterFacts): Journey {
  const tripHref = (anchor: string) => (f.trip ? `/my-world/${lower(f.trip.code)}/visits/${f.trip.id}/edit#${anchor}` : null);
  const eventHref = (anchor: string) => (f.event ? `/events/${f.event}/edit#${anchor}` : null);

  const steps: JourneyStep[] = [
    {
      id: "introduce",
      title: "Introduce yourself",
      story: "Every story needs its main character. Add your name and a photo, so friends know it's you.",
      doneLine: "Friends will know it's you.",
      icon: "user",
      done: f.steps.introduce,
      action: { label: "Add my name and photo", href: "/settings" },
    },
    {
      id: "map",
      title: "Light up your map",
      story: "Where has life taken you so far? Tap every country you've been to and watch your world fill in.",
      doneLine: `${f.countries} countries and counting.`,
      icon: "globe",
      done: f.steps.map,
      progress: f.steps.map ? undefined : `${Math.min(f.countries, 3)} of 3 countries`,
      action: { label: "Light up my map", href: "/my-world/light-up" },
    },
    {
      id: "trip",
      title: "Your first trip",
      story: "Pick a trip you loved and add its photos. That's when a pin on the map becomes a memory.",
      doneLine: "A pin became a memory.",
      icon: "camera",
      done: f.steps.trip,
      action: {
        label: "Add a trip's photos",
        href: tripHref("photos") ?? (f.latestCountry ? `/my-world/${lower(f.latestCountry)}#add` : "/my-world/light-up"),
      },
    },
    {
      id: "event",
      title: "A moment you'll never forget",
      story: "A concert, a match, a festival, a wedding. Keep the day (or the night) it happened.",
      doneLine: "That one's kept for good.",
      icon: "ticket",
      done: f.steps.event,
      action: { label: "Add an event", href: "/events/new" },
    },
    {
      id: "song",
      title: "Give it a soundtrack",
      story: "Every memory has a song. Pick the one that takes you straight back there.",
      doneLine: "Now it plays when it's opened.",
      icon: "music",
      done: f.steps.song,
      action: { label: "Pick a song", href: tripHref("song") ?? eventHref("song") ?? "/my-world" },
    },
    {
      id: "people",
      title: "Find your people",
      story: "Follow three friends. Their trips and nights out will fill your feed, and yours will reach them.",
      doneLine: `You follow ${f.following} people.`,
      icon: "users",
      done: f.steps.people,
      progress: f.steps.people ? undefined : `${Math.min(f.following, 3)} of 3 friends`,
      action: { label: "Find friends", href: "/feed?friends=1" },
    },
    {
      id: "together",
      title: "Who was there?",
      story: "Memories are better shared. Add a friend to one of yours, or tap “I was there” on theirs.",
      doneLine: "Your stories are connected now.",
      icon: "handshake",
      done: f.steps.together,
      action: { label: "Add who was with me", href: tripHref("collaborators") ?? eventHref("collaborators") ?? "/feed" },
    },
    {
      id: "hello",
      title: "Say hello",
      story: "Send your first message. Ask a friend about a place they've been, or just say hi.",
      doneLine: "The first of many conversations.",
      icon: "chat",
      done: f.steps.hello,
      action: { label: "Open chat", openChat: true },
    },
  ];

  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, finished: done === steps.length || !!f.finishedAt, next: steps.find((s) => !s.done) ?? null };
}

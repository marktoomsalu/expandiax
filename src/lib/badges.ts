import type { LucideIcon } from "lucide-react";
import {
  Footprints, Compass, Map, Globe2, Plane, Rocket, Crown,
  Layers, Orbit, Globe,
  BookOpen, CalendarCheck, Archive, Library,
  Music2, PartyPopper, Trophy, Presentation, Heart, Sparkles, Award,
  Star, Camera, Gem, CalendarDays, Hourglass,
  Users, HeartHandshake, Medal, Snowflake, Sparkle,
} from "lucide-react";
import type { AllTimeStats } from "./stats";
import { TOTAL_COUNTRIES } from "./countries";

export type BadgeGroup = "countries" | "continents" | "events" | "types" | "friends" | "curation";

export const BADGE_GROUP_LABELS: Record<BadgeGroup, string> = {
  countries: "Countries",
  continents: "Continents",
  events: "Events",
  types: "Event types",
  friends: "Friends",
  curation: "Curation",
};

/** In the order they're shown. */
export const BADGE_GROUPS: BadgeGroup[] = ["countries", "events", "friends", "continents", "types", "curation"];

/**
 * What everything is counted from: your archive, friends who joined with
 * your invite, the friends you've connected with by World Connect, and
 * whether Antarctica (a territory, not counted as a country) is on your map.
 */
export type BadgeExtras = { invitedFriends?: number; worldConnects?: number; antarctica?: boolean };
export type BadgeStats = AllTimeStats & Required<BadgeExtras>;

/** How to get a locked badge: a page, or the Add a country sheet. */
export type BadgeAction = { label: string; href: string } | { label: string; addCountry: true };

type BadgeDef = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: BadgeGroup;
  target: number;
  progress: (s: BadgeStats) => number;
  /** "3/5 friends joined": what the numbers count. */
  unit: string;
  action: BadgeAction;
};

export type EvaluatedBadge = Omit<BadgeDef, "progress"> & { current: number; isUnlocked: boolean };

const ADD_COUNTRY: BadgeAction = { label: "Add a country", addCountry: true };
const ADD_EVENT: BadgeAction = { label: "Add an event", href: "/events/new" };
const INVITE: BadgeAction = { label: "Invite friends", href: "/invite" };

const DEFAULT_ACTION: Record<BadgeGroup, BadgeAction> = {
  countries: ADD_COUNTRY,
  continents: ADD_COUNTRY,
  events: ADD_EVENT,
  types: ADD_EVENT,
  friends: INVITE,
  curation: ADD_EVENT,
};
const DEFAULT_UNIT: Record<BadgeGroup, string> = {
  countries: "countries visited",
  continents: "continents",
  events: "events logged",
  types: "event types",
  friends: "friends joined",
  curation: "",
};

const def = (
  id: string,
  label: string,
  description: string,
  icon: LucideIcon,
  group: BadgeGroup,
  target: number,
  progress: (s: BadgeStats) => number,
  more: Partial<Pick<BadgeDef, "unit" | "action">> = {}
): BadgeDef => ({ id, label, description, icon, group, target, progress, unit: more.unit ?? DEFAULT_UNIT[group], action: more.action ?? DEFAULT_ACTION[group] });

export const BADGES: BadgeDef[] = [
  def("country-1", "First Stamp", "Log your first country.", Footprints, "countries", 1, (s) => s.totalCountries),
  def("country-5", "Explorer", "Visit 5 countries.", Compass, "countries", 5, (s) => s.totalCountries),
  def("country-10", "Wanderer", "Visit 10 countries.", Map, "countries", 10, (s) => s.totalCountries),
  def("country-25", "Globetrotter", "Visit 25 countries.", Globe2, "countries", 25, (s) => s.totalCountries),
  def("country-50", "Jetsetter", "Visit 50 countries.", Plane, "countries", 50, (s) => s.totalCountries),
  def("country-100", "Voyager", "Visit 100 countries.", Rocket, "countries", 100, (s) => s.totalCountries),
  def("country-195", "World Conqueror", "Visit every recognised country.", Crown, "countries", TOTAL_COUNTRIES, (s) => s.totalCountries),

  def("continents-3", "Continental", "Set foot on 3 continents.", Layers, "continents", 3, (s) => s.continentsVisited),
  def("continents-5", "Hemisphere Hopper", "Set foot on 5 continents.", Orbit, "continents", 5, (s) => s.continentsVisited),
  def("continents-6", "All Six", "Set foot on every continent.", Globe, "continents", 6, (s) => s.continentsVisited),
  def("antarctica", "Polar Explorer", "Set foot on Antarctica.", Snowflake, "continents", 1, (s) => (s.antarctica ? 1 : 0), { action: { label: "Add Antarctica", addCountry: true } }),

  def("events-1", "First Memory", "Log your first event.", BookOpen, "events", 1, (s) => s.totalEvents),
  def("events-10", "Regular", "Log 10 events.", CalendarCheck, "events", 10, (s) => s.totalEvents),
  def("events-25", "Archivist", "Log 25 events.", Archive, "events", 25, (s) => s.totalEvents),
  def("events-50", "Chronicler", "Log 50 events.", Library, "events", 50, (s) => s.totalEvents),

  def("type-concert", "Concert Goer", "Log your first concert.", Music2, "types", 1, (s) => s.eventsByType.concert, { action: { label: "Add a concert", href: "/events/new" } }),
  def("type-festival", "Festival Fanatic", "Log your first festival.", PartyPopper, "types", 1, (s) => s.eventsByType.festival, { action: { label: "Add a festival", href: "/events/new" } }),
  def("type-sport", "Superfan", "Log your first sport event.", Trophy, "types", 1, (s) => s.eventsByType.sport, { action: { label: "Add a match", href: "/events/new" } }),
  def("type-conference", "Delegate", "Log your first conference.", Presentation, "types", 1, (s) => s.eventsByType.conference),
  def("type-personal", "Guest of Honour", "Log your first personal event.", Heart, "types", 1, (s) => s.eventsByType.personal),
  def("type-other", "Free Spirit", "Log your first “other” event.", Sparkles, "types", 1, (s) => s.eventsByType.other),
  def(
    "type-all",
    "Renaissance Traveller",
    "Log at least one of every event type.",
    Award,
    "types",
    6,
    (s) => Object.values(s.eventsByType).filter((n) => n > 0).length
  ),

  def("perfect-night", "Perfect Night", "Rate an event a perfect 10.", Star, "curation", 1, (s) => (s.topRating === 10 ? 1 : 0), { action: { label: "Rate an event", href: "/events" } }),
  def("photographer", "Photographer", "Keep 50 photos in your archive.", Camera, "curation", 50, (s) => s.totalPhotos, { unit: "photos", action: { label: "Add photos", href: "/my-world" } }),
  def("curator", "Curator", "Mark 5 favourites.", Gem, "curation", 5, (s) => s.favouriteCount, { unit: "favourites", action: { label: "Pick favourites", href: "/events" } }),
  def("frequent-flyer", "Frequent Flyer", "Stay active across 3 different years.", CalendarDays, "curation", 3, (s) => s.yearsActive.length, { unit: "years", action: { label: "Add a trip", addCountry: true } }),
  def(
    "old-soul",
    "Old Soul",
    "Keep a memory from 5+ years ago.",
    Hourglass,
    "curation",
    1,
    (s) => (s.oldestYear !== null && new Date().getFullYear() - s.oldestYear >= 5 ? 1 : 0),
    { action: { label: "Add an old trip", addCountry: true } }
  ),

  def("friends-5", "Connector", "Bring 5 friends to ExpandiaX.", Users, "friends", 5, (s) => s.invitedFriends),
  def("friends-10", "Ambassador", "Bring 10 friends to ExpandiaX.", HeartHandshake, "friends", 10, (s) => s.invitedFriends),
  def("friends-25", "Trailblazer", "Bring 25 friends to ExpandiaX.", Medal, "friends", 25, (s) => s.invitedFriends),
  def("world-connect", "Worlds Collide", "Connect with a friend using World Connect.", Sparkle, "friends", 1, (s) => s.worldConnects, {
    action: { label: "Open World Connect", href: "/touch" },
  }),
];

/** Every badge, with how far along you are. */
export function evaluateBadges(stats: AllTimeStats, extras: BadgeExtras = {}): EvaluatedBadge[] {
  const all: BadgeStats = { ...stats, invitedFriends: extras.invitedFriends ?? 0, worldConnects: extras.worldConnects ?? 0, antarctica: extras.antarctica ?? false };
  return BADGES.map(({ progress, ...b }) => {
    const current = Math.min(progress(all), b.target);
    return { ...b, current, isUnlocked: current >= b.target };
  });
}

// Not a stats-based badge like the ones above (there's nothing to unlock
// through the app itself), so it lives outside BADGES/evaluateBadges —
// it's a permanent fact of when someone signed up, keyed off
// profiles.signup_number rather than AllTimeStats.
export const EARLY_EXPLORER_THRESHOLD = 1000;

export function isEarlyExplorer(signupNumber: number): boolean {
  return signupNumber <= EARLY_EXPLORER_THRESHOLD;
}

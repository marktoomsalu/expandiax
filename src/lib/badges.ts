import type { LucideIcon } from "lucide-react";
import {
  Footprints, Compass, Map, Globe2, Plane, Rocket, Crown,
  Layers, Orbit, Globe,
  BookOpen, CalendarCheck, Archive, Library,
  Music2, PartyPopper, Trophy, Presentation, Heart, Sparkles, Award,
  Star, Camera, Gem, CalendarDays, Hourglass,
} from "lucide-react";
import type { AllTimeStats } from "./stats";

export type BadgeGroup = "countries" | "continents" | "events" | "types" | "curation";

export const BADGE_GROUP_LABELS: Record<BadgeGroup, string> = {
  countries: "Countries",
  continents: "Continents",
  events: "Events",
  types: "Event types",
  curation: "Curation",
};

type BadgeDef = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: BadgeGroup;
  target: number;
  progress: (s: AllTimeStats) => number;
};

export type EvaluatedBadge = Omit<BadgeDef, "progress"> & { current: number; isUnlocked: boolean };

const def = (
  id: string,
  label: string,
  description: string,
  icon: LucideIcon,
  group: BadgeGroup,
  target: number,
  progress: (s: AllTimeStats) => number
): BadgeDef => ({ id, label, description, icon, group, target, progress });

export const BADGES: BadgeDef[] = [
  def("country-1", "First Stamp", "Log your first country.", Footprints, "countries", 1, (s) => s.totalCountries),
  def("country-5", "Explorer", "Visit 5 countries.", Compass, "countries", 5, (s) => s.totalCountries),
  def("country-10", "Wanderer", "Visit 10 countries.", Map, "countries", 10, (s) => s.totalCountries),
  def("country-25", "Globetrotter", "Visit 25 countries.", Globe2, "countries", 25, (s) => s.totalCountries),
  def("country-50", "Jetsetter", "Visit 50 countries.", Plane, "countries", 50, (s) => s.totalCountries),
  def("country-100", "Voyager", "Visit 100 countries.", Rocket, "countries", 100, (s) => s.totalCountries),
  def("country-195", "World Conqueror", "Visit every recognised country.", Crown, "countries", 195, (s) => s.totalCountries),

  def("continents-3", "Continental", "Set foot on 3 continents.", Layers, "continents", 3, (s) => s.continentsVisited),
  def("continents-5", "Hemisphere Hopper", "Set foot on 5 continents.", Orbit, "continents", 5, (s) => s.continentsVisited),
  def("continents-6", "All Six", "Set foot on every continent.", Globe, "continents", 6, (s) => s.continentsVisited),

  def("events-1", "First Memory", "Log your first event.", BookOpen, "events", 1, (s) => s.totalEvents),
  def("events-10", "Regular", "Log 10 events.", CalendarCheck, "events", 10, (s) => s.totalEvents),
  def("events-25", "Archivist", "Log 25 events.", Archive, "events", 25, (s) => s.totalEvents),
  def("events-50", "Chronicler", "Log 50 events.", Library, "events", 50, (s) => s.totalEvents),

  def("type-concert", "Concert Goer", "Log your first concert.", Music2, "types", 1, (s) => s.eventsByType.concert),
  def("type-festival", "Festival Fanatic", "Log your first festival.", PartyPopper, "types", 1, (s) => s.eventsByType.festival),
  def("type-sport", "Superfan", "Log your first sport event.", Trophy, "types", 1, (s) => s.eventsByType.sport),
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

  def("perfect-night", "Perfect Night", "Rate an event a perfect 10.", Star, "curation", 1, (s) => (s.topRating === 10 ? 1 : 0)),
  def("photographer", "Photographer", "Keep 50 photos in your archive.", Camera, "curation", 50, (s) => s.totalPhotos),
  def("curator", "Curator", "Mark 5 favourites.", Gem, "curation", 5, (s) => s.favouriteCount),
  def("frequent-flyer", "Frequent Flyer", "Stay active across 3 different years.", CalendarDays, "curation", 3, (s) => s.yearsActive.length),
  def(
    "old-soul",
    "Old Soul",
    "Keep a memory from 5+ years ago.",
    Hourglass,
    "curation",
    1,
    (s) => (s.oldestYear !== null && new Date().getFullYear() - s.oldestYear >= 5 ? 1 : 0)
  ),
];

export function evaluateBadges(stats: AllTimeStats): EvaluatedBadge[] {
  return BADGES.map(({ progress, ...b }) => {
    const current = Math.min(progress(stats), b.target);
    return { ...b, current, isUnlocked: current >= b.target };
  });
}

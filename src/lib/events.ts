import { Music2, PartyPopper, Trophy, Presentation, Heart, Sparkles } from "lucide-react";
import type { EventType } from "./types";

export type EventTypeMeta = {
  value: EventType;
  label: string;
  icon: typeof Music2;
  titleLabel: string;
  titlePlaceholder: string;
  highlightLabel: string;
  notesLabel: string;
  /** Whether this type shows the Spotify artist picker (their photo stands in as the cover). */
  hasArtist?: boolean;
};

export const EVENT_TYPES: EventTypeMeta[] = [
  {
    value: "concert",
    label: "Concert",
    icon: Music2,
    titleLabel: "Artist or band",
    titlePlaceholder: "Metsatöll",
    highlightLabel: "Favourite song performed",
    notesLabel: "Setlist notes",
    hasArtist: true,
  },
  {
    value: "festival",
    label: "Festival",
    icon: PartyPopper,
    titleLabel: "Festival name",
    titlePlaceholder: "Positivus",
    highlightLabel: "Best moment",
    notesLabel: "Notes",
    hasArtist: true,
  },
  {
    value: "sport",
    label: "Sport",
    icon: Trophy,
    titleLabel: "Teams or match",
    titlePlaceholder: "Estonia vs Latvia",
    highlightLabel: "Best moment",
    notesLabel: "Notes",
  },
  {
    value: "conference",
    label: "Conference",
    icon: Presentation,
    titleLabel: "Conference name",
    titlePlaceholder: "WWDC 2024",
    highlightLabel: "Key takeaway",
    notesLabel: "Notes",
  },
  {
    value: "personal",
    label: "Personal",
    icon: Heart,
    titleLabel: "Occasion",
    titlePlaceholder: "Anna & John's wedding",
    highlightLabel: "Highlight",
    notesLabel: "Notes",
  },
  {
    value: "other",
    label: "Other",
    icon: Sparkles,
    titleLabel: "Event name",
    titlePlaceholder: "",
    highlightLabel: "Highlight",
    notesLabel: "Notes",
  },
];

const byValue = new Map(EVENT_TYPES.map((t) => [t.value, t]));

export function eventTypeMeta(type: EventType): EventTypeMeta {
  return byValue.get(type) ?? EVENT_TYPES[0];
}

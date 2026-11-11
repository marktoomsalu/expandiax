import { Lock, Rss, Users, type LucideIcon } from "lucide-react";

// Who sees a trip, stay or event (migration 062).
export type Audience = "everyone" | "friends" | "only_me";

export const AUDIENCES: { value: Audience; label: string; note: string; icon: LucideIcon }[] = [
  { value: "everyone", label: "Everyone", note: "Anyone who can see your profile", icon: Rss },
  { value: "friends", label: "Friends", note: "Only people you follow each other with", icon: Users },
  { value: "only_me", label: "Only me", note: "Completely private, its photos too", icon: Lock },
];

export const audienceOf = (value: string | null | undefined): Audience =>
  value === "friends" || value === "only_me" ? value : "everyone";

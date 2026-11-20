/**
 * Anonymous usage totals (migration 086): a page's kind, never the page
 * itself. "/my-world/it/visits/8f3…" counts as "trip", "/u/karla" as
 * "profile", so no trip, country or person is ever recorded.
 */

export const PAGE_LABELS: Record<string, string> = {
  feed: "Feed",
  explore: "Explore",
  my_world: "My World",
  country: "A country",
  trip: "A trip",
  trip_edit: "Editing a trip",
  light_up: "Light up your map",
  us_states: "US states",
  events: "Events",
  event: "An event",
  event_edit: "Editing an event",
  event_new: "Adding an event",
  profile: "A profile",
  profile_list: "A profile's countries, events or trips",
  profile_post: "A post",
  follow_list: "Followers and following",
  explore_country: "Explore: a country",
  explore_place: "Explore: a town",
  explore_events: "Explore: events",
  explore_people: "Explore: people",
  explore_other: "Explore: more",
  notifications: "Notifications",
  together: "Together",
  world_connect: "World Connect",
  journey: "Chapter One",
  stats: "Stats and badges",
  invite: "Invite friends",
  settings: "Settings",
  onboarding: "First steps",
  other: "Other pages",
};

export const FEATURE_LABELS: Record<string, string> = {
  invite_shared: "Invite link shared",
  chat_opened: "Chat opened",
  memory_invite_sent: "Invitation to a memory sent",
  world_scan_started: "Find my world: started",
  world_scan_finished: "Find my world: finished",
};

/** The kind of page at this address, or null for pages not counted (sign-in, legal, admin). */
export function pageKey(pathname: string, search = ""): string | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  const s = p.split("/").filter(Boolean);
  const [a, b, c, d, e] = s;
  if (p === "/feed") return new URLSearchParams(search).get("tab") === "explore" ? "explore" : "feed";
  switch (a) {
    case "my-world":
      if (!b) return "my_world";
      if (b === "light-up") return "light_up";
      if (b === "states") return "us_states";
      if (c === "visits" && d) return e === "edit" ? "trip_edit" : "trip";
      return "country";
    case "events":
      if (!b) return "events";
      if (b === "new") return "event_new";
      return c === "edit" ? "event_edit" : "event";
    case "u":
      if (!b) return null;
      if (!c) return "profile";
      if (c === "followers" || c === "following") return "follow_list";
      if (c === "post" || d) return "profile_post";
      return "profile_list";
    case "explore":
      if (!b) return "explore";
      if (b === "country") return "explore_country";
      if (b === "place") return "explore_place";
      if (b === "events") return "explore_events";
      if (b === "people") return "explore_people";
      return "explore_other";
    case "notifications":
      return "notifications";
    case "together":
      return "together";
    case "touch":
      return "world_connect";
    case "journey":
      return "journey";
    case "stats":
      return "stats";
    case "invite":
      return "invite";
    case "settings":
      return "settings";
    case "onboarding":
    case "start":
      return "onboarding";
    case "admin":
    case "sign-in":
    case "sign-up":
    case "auth":
    case "privacy":
    case "terms":
    case "join":
    case "dev-preview":
    case "appstore-screens":
      return null;
    default:
      return p === "/" ? null : "other";
  }
}

/** Seconds, in words for the dashboard: "4 min 20 s". */
export function duration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "–";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m >= 60) return `${Math.floor(m / 60)} h ${m % 60} min`;
  return m ? `${m} min ${s} s` : `${s} s`;
}

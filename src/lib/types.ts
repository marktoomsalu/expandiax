// Friends-only accounts became private in migration 062.
export type ProfileVisibility = "public" | "private";
export type Plan = "free" | "premium";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  // Their own cover photo (migration 063); without one, their home country's photos take turns.
  cover_url?: string | null;
  bio: string;
  home_country_code: string | null;
  visibility: ProfileVisibility;
  discoverable: boolean; // false = left out of search and suggestions
  plan: Plan;
  accent_color: string | null;
  weekly_digest_enabled: boolean;
  follow_email_enabled: boolean; // false = no "X started following you" emails
  // Push categories (migration 060), all on by default.
  push_followers: boolean;
  push_messages: boolean;
  push_activity: boolean;
  push_reminders: boolean;
  push_updates: boolean;
  signup_number: number;
  feed_last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VisitedUSState = {
  id: string;
  user_id: string;
  state_code: string;
  state_name: string;
  note: string;
  is_favourite: boolean;
  created_at: string;
  updated_at: string;
};


export type VisitedCountry = {
  id: string;
  user_id: string;
  country_code: string;
  country_name: string;
  cover_media_id: string | null;
  is_favourite: boolean;
  share_to_feed: boolean;
  is_public: boolean; // false = "Only me"
  created_at: string;
  updated_at: string;
};

export type DatePrecision = "year" | "month" | "day";

export type CountryVisit = {
  id: string;
  visited_country_id: string;
  // false = "Only me": this trip, its places and photos are hidden from everyone else (migration 061).
  is_public: boolean;
  // Who sees it (migration 062): "everyone" (Feed), "friends" (mutual follows) or "only_me".
  audience?: "everyone" | "friends" | "only_me";
  cover_media_id: string | null;
  year: number;
  visited_from: string | null;
  visited_to: string | null;
  date_precision: DatePrecision;
  highlight: string;
  spotify_track_id: string | null;
  spotify_track_name: string | null;
  spotify_track_artist: string | null;
  spotify_track_image: string | null;
  title: string; // "Slovenia Road Trip" — empty until named
  kind: TripKind;
};
export type TripKind = "trip" | "lived";

/** A place within a trip: its own dates, order in the journey, and spot on the map. */
export type CountryCity = {
  id: string;
  visited_country_id: string;
  country_visit_id: string;
  city_name: string;
  arrived: string | null;
  departed: string | null;
  position: number;
  lat: number | null;
  lng: number | null;
};

export type MediaItem = {
  id: string;
  storage_path: string;
  public_url: string;
  media_type: "image" | "video";
  caption: string;
  display_order: number;
  focal_x: number | null;
  focal_y: number | null;
  created_at: string;
  // When it was taken (migration 066), for keeping photos in time order.
  taken_at?: string | null;
};

export type CountryMedia = MediaItem & { visited_country_id: string; country_visit_id: string; city_id: string | null };
export type EventMedia = MediaItem & { event_id: string };

export type EventType = "concert" | "festival" | "sport" | "conference" | "personal" | "other";

export type Event = {
  id: string;
  user_id: string;
  // Who sees it (migration 062): "everyone" (Feed), "friends" (mutual follows) or "only_me".
  audience?: "everyone" | "friends" | "only_me";
  event_type: EventType;
  title: string;
  subtitle: string;
  event_date: string;
  venue: string;
  city: string;
  country_code: string;
  country_name: string;
  rating: number | null;
  review: string;
  highlight: string;
  notes: string;
  cover_media_id: string | null;
  is_favourite: boolean;
  is_public: boolean;
  share_to_feed: boolean;
  spotify_artist_id: string | null;
  spotify_artist_name: string | null;
  spotify_artist_image: string | null;
  spotify_favourite_track_id: string | null;
  created_at: string;
  updated_at: string;
};

export type VisitedCountryFull = VisitedCountry & {
  country_visits: CountryVisit[];
  country_cities: CountryCity[];
  country_media: CountryMedia[];
};

export type EventFull = Event & { event_media: EventMedia[] };

export type Follow = { follower_id: string; followee_id: string; created_at: string };

export type Comment = {
  id: string;
  user_id: string;
  kind: "country" | "event";
  target_id: string;
  body: string;
  created_at: string;
};

export type CommentWithAuthor = Comment & {
  profiles: Pick<Profile, "username" | "display_name" | "avatar_url"> | null;
};

/** "question": someone you follow asked about a place you've been; "answer": someone answered your question. */
export type NotificationKind = "like" | "comment" | "follow" | "follow_request" | "follow_accepted" | "question" | "answer" | "invite_joined";

export type Notification = {
  id: string;
  user_id: string;
  actor_id: string;
  kind: NotificationKind;
  target_kind: "country" | "event" | "question" | null;
  target_id: string | null;
  comment_body: string | null;
  read: boolean;
  created_at: string;
};

export type NotificationWithActor = Notification & {
  actor: Pick<Profile, "username" | "display_name" | "avatar_url"> | null;
};

export type DeviceToken = {
  id: string;
  user_id: string;
  token: string;
  platform: "ios" | "android";
  created_at: string;
  updated_at: string;
};

export type FeedEvent = {
  kind: "country" | "event";
  event_type: EventType | null;
  ref_id: string;
  actor_id: string;
  country_code: string;
  country_name: string | null;
  title: string;
  subtitle: string | null;
  body: string | null;
  venue: string | null;
  city: string | null;
  cover_url: string | null;
  cover_media_type: "image" | "video" | null;
  visit_year: number | null;
  visit_date: string | null;
  visit_date_precision: DatePrecision | null;
  spotify_track_id: string | null;
  spotify_track_name: string | null;
  spotify_track_artist: string | null;
  created_at: string;
};

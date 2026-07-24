export type ProfileVisibility = "public" | "friends" | "private";
export type Plan = "free" | "premium";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  home_country_code: string | null;
  visibility: ProfileVisibility;
  plan: Plan;
  accent_color: string | null;
  created_at: string;
  updated_at: string;
};

export type Billing = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: Plan;
  current_period_end: string | null;
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
  note: string;
  cover_media_id: string | null;
  is_favourite: boolean;
  share_to_feed: boolean;
  created_at: string;
  updated_at: string;
};

export type DatePrecision = "year" | "month" | "day";

export type CountryVisit = {
  id: string;
  visited_country_id: string;
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
};
export type CountryCity = { id: string; visited_country_id: string; city_name: string };

export type MediaItem = {
  id: string;
  storage_path: string;
  public_url: string;
  media_type: "image" | "video";
  caption: string;
  display_order: number;
  created_at: string;
};

export type CountryMedia = MediaItem & { visited_country_id: string; country_visit_id: string | null };
export type EventMedia = MediaItem & { event_id: string };

export type EventType = "concert" | "festival" | "sport" | "conference" | "personal" | "other";

export type Event = {
  id: string;
  user_id: string;
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

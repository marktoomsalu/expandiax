export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  home_country_code: string | null;
  is_public: boolean;
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

export type CountryVisit = { id: string; visited_country_id: string; year: number; highlight: string };
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

export type CountryMedia = MediaItem & { visited_country_id: string };
export type ConcertMedia = MediaItem & { concert_id: string };

export type Concert = {
  id: string;
  user_id: string;
  artist_name: string;
  concert_name: string;
  concert_date: string;
  venue: string;
  city: string;
  country_code: string;
  country_name: string;
  rating: number | null;
  review: string;
  favourite_song: string;
  setlist_notes: string;
  cover_media_id: string | null;
  is_favourite: boolean;
  is_public: boolean;
  share_to_feed: boolean;
  created_at: string;
  updated_at: string;
};

export type VisitedCountryFull = VisitedCountry & {
  country_visits: CountryVisit[];
  country_cities: CountryCity[];
  country_media: CountryMedia[];
};

export type ConcertFull = Concert & { concert_media: ConcertMedia[] };

export type Follow = { follower_id: string; followee_id: string; created_at: string };

export type FeedEvent = {
  kind: "country" | "concert";
  ref_id: string;
  actor_id: string;
  country_code: string;
  title: string;
  subtitle: string | null;
  cover_url: string | null;
  cover_media_type: "image" | "video" | null;
  created_at: string;
};

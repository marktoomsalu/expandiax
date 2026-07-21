"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES, countryByCode } from "@/lib/countries";
import { RatingInput } from "./Rating";
import type { Concert } from "@/lib/types";

export function ConcertForm({ concert }: { concert?: Concert }) {
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState({
    artist_name: concert?.artist_name ?? "",
    concert_name: concert?.concert_name ?? "",
    concert_date: concert?.concert_date ?? "",
    venue: concert?.venue ?? "",
    city: concert?.city ?? "",
    country_code: concert?.country_code ?? "",
    rating: concert?.rating ?? null,
    review: concert?.review ?? "",
    favourite_song: concert?.favourite_song ?? "",
    setlist_notes: concert?.setlist_notes ?? "",
    is_public: concert?.is_public ?? true,
    is_favourite: concert?.is_favourite ?? false,
    share_to_feed: concert?.share_to_feed ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) =>
    setF((cur) => ({ ...cur, [key]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!f.artist_name.trim() || !f.concert_date || !f.country_code) {
      setError("Artist, date and country are required.");
      return;
    }
    setBusy(true);
    const meta = countryByCode(f.country_code)!;
    const payload = {
      artist_name: f.artist_name.trim(),
      concert_name: f.concert_name.trim(),
      concert_date: f.concert_date,
      venue: f.venue.trim(),
      city: f.city.trim(),
      country_code: meta.code,
      country_name: meta.name,
      rating: f.rating,
      review: f.review.trim(),
      favourite_song: f.favourite_song.trim(),
      setlist_notes: f.setlist_notes.trim(),
      is_public: f.is_public,
      is_favourite: f.is_favourite,
      share_to_feed: f.share_to_feed,
    };

    if (concert) {
      const { error: err } = await supabase.from("concerts").update(payload).eq("id", concert.id);
      if (err) {
        setError("Could not save the concert. Try again.");
        setBusy(false);
        return;
      }
      setSaved(true);
      setBusy(false);
      router.refresh();
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Your session expired. Please sign in again.");
        setBusy(false);
        return;
      }
      const { data, error: err } = await supabase
        .from("concerts")
        .insert({ ...payload, user_id: user.id })
        .select("id")
        .single();
      if (err || !data) {
        setError("Could not create the concert. Try again.");
        setBusy(false);
        return;
      }
      router.push(`/concerts/${data.id}/edit?created=1`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="c-artist" className="mb-1.5 block text-sm font-medium">Artist or band *</label>
          <input id="c-artist" className="field" value={f.artist_name} onChange={(e) => set("artist_name", e.target.value)} required placeholder="Metsatöll" />
        </div>
        <div>
          <label htmlFor="c-name" className="mb-1.5 block text-sm font-medium">Concert or tour name</label>
          <input id="c-name" className="field" value={f.concert_name} onChange={(e) => set("concert_name", e.target.value)} placeholder="Katk Kutsariks Tour" />
        </div>
        <div>
          <label htmlFor="c-date" className="mb-1.5 block text-sm font-medium">Date *</label>
          <input id="c-date" type="date" className="field" value={f.concert_date} onChange={(e) => set("concert_date", e.target.value)} required />
        </div>
        <div>
          <label htmlFor="c-venue" className="mb-1.5 block text-sm font-medium">Venue</label>
          <input id="c-venue" className="field" value={f.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Saku Suurhall" />
        </div>
        <div>
          <label htmlFor="c-city" className="mb-1.5 block text-sm font-medium">City</label>
          <input id="c-city" className="field" value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Tallinn" />
        </div>
        <div>
          <label htmlFor="c-country" className="mb-1.5 block text-sm font-medium">Country *</label>
          <select id="c-country" className="field" value={f.country_code} onChange={(e) => set("country_code", e.target.value)} required>
            <option value="">Choose a country</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium">Your rating</span>
        <RatingInput value={f.rating} onChange={(v) => set("rating", v)} />
      </div>

      <div>
        <label htmlFor="c-review" className="mb-1.5 block text-sm font-medium">The memory</label>
        <textarea id="c-review" className="field min-h-28" value={f.review} onChange={(e) => set("review", e.target.value)} maxLength={2000} placeholder="The moment the lights dropped and the first chord hit…" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="c-song" className="mb-1.5 block text-sm font-medium">Favourite song performed</label>
          <input id="c-song" className="field" value={f.favourite_song} onChange={(e) => set("favourite_song", e.target.value)} />
        </div>
        <div>
          <label htmlFor="c-setlist" className="mb-1.5 block text-sm font-medium">Setlist notes</label>
          <input id="c-setlist" className="field" value={f.setlist_notes} onChange={(e) => set("setlist_notes", e.target.value)} placeholder="Opened with…, encore was…" />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-line bg-surface px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={f.is_public} onChange={(e) => set("is_public", e.target.checked)} />
          Visible on my public profile
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={f.is_favourite} onChange={(e) => set("is_favourite", e.target.checked)} />
          My favourite concert
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={f.share_to_feed} onChange={(e) => set("share_to_feed", e.target.checked)} />
          Show in followers&rsquo; feeds
        </label>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-800/20 bg-red-800/5 px-3 py-2 text-sm text-red-800 dark:text-red-400">{error}</p>}
      {saved && <p role="status" className="rounded-lg border border-accent/40 bg-accent-soft/50 px-3 py-2 text-sm">Concert saved.</p>}

      <button type="submit" className="btn-accent" disabled={busy}>
        {busy ? "Saving…" : concert ? "Save changes" : "Add concert"}
      </button>
    </form>
  );
}

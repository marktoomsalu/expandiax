"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, MapPinPlus, Plus, Rss, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { VisitedCountryFull } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { cn, formatVisitRange, visitSortKey } from "@/lib/utils";

type Meta = { code: string; name: string; flag: string };

export function MarkVisitedButton({ meta }: { meta: Meta }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mark() {
    setBusy(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Your session expired. Please sign in again.");
      setBusy(false);
      return;
    }
    const { error: err } = await supabase.from("visited_countries").insert({
      user_id: user.id,
      country_code: meta.code,
      country_name: meta.name,
    });
    if (err) {
      setError(
        err.code === "23505"
          ? `${meta.name} is already on your map.`
          : "Could not mark this country. Try again."
      );
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button type="button" className="btn-accent" onClick={mark} disabled={busy}>
        <MapPinPlus size={17} />
        {busy ? "Adding to your map…" : `Mark ${meta.name} as visited`}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-red-800 dark:text-red-400">{error}</p>}
    </div>
  );
}

export function CountryEditor({ data, meta }: { data: VisitedCountryFull; meta: Meta }) {
  const router = useRouter();
  const supabase = createClient();
  const [note, setNote] = useState(data.note);
  const [noteSaved, setNoteSaved] = useState(false);
  const [year, setYear] = useState("");
  const [visitedFrom, setVisitedFrom] = useState("");
  const [visitedTo, setVisitedTo] = useState("");
  const [highlight, setHighlight] = useState("");
  const [city, setCity] = useState("");
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [favouriteBusy, setFavouriteBusy] = useState(false);
  const [feedBusy, setFeedBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visits = [...data.country_visits].sort((a, b) => visitSortKey(a).localeCompare(visitSortKey(b)));

  async function addVisit(e: React.FormEvent) {
    e.preventDefault();
    const y = parseInt(year, 10);
    if (Number.isNaN(y) || y < 1900 || y > 2100) {
      setError("Enter a year between 1900 and 2100.");
      return;
    }
    if (visitedFrom && visitedTo && visitedTo < visitedFrom) {
      setError("The \"to\" date can't be before the \"from\" date.");
      return;
    }
    setError(null);
    const { error: err } = await supabase.from("country_visits").insert({
      visited_country_id: data.id,
      year: y,
      visited_from: visitedFrom || null,
      visited_to: visitedTo || null,
      highlight: highlight.trim(),
    });
    if (err) setError("Could not add that visit.");
    else {
      setYear("");
      setVisitedFrom("");
      setVisitedTo("");
      setHighlight("");
      router.refresh();
    }
  }

  async function removeVisit(id: string) {
    await supabase.from("country_visits").delete().eq("id", id);
    router.refresh();
  }

  async function addCity(e: React.FormEvent) {
    e.preventDefault();
    const name = city.trim();
    if (!name) return;
    await supabase.from("country_cities").insert({ visited_country_id: data.id, city_name: name });
    setCity("");
    router.refresh();
  }

  async function removeCity(id: string) {
    await supabase.from("country_cities").delete().eq("id", id);
    router.refresh();
  }

  async function saveNoteIfChanged() {
    const trimmed = note.trim();
    if (trimmed === data.note.trim()) return;
    await supabase.from("visited_countries").update({ note: trimmed }).eq("id", data.id);
    setNoteSaved(true);
    router.refresh();
  }

  async function toggleFavourite() {
    setFavouriteBusy(true);
    await supabase
      .from("visited_countries")
      .update({ is_favourite: !data.is_favourite })
      .eq("id", data.id);
    setFavouriteBusy(false);
    router.refresh();
  }

  async function toggleShareToFeed() {
    setFeedBusy(true);
    await supabase
      .from("visited_countries")
      .update({ share_to_feed: !data.share_to_feed })
      .eq("id", data.id);
    setFeedBusy(false);
    router.refresh();
  }

  async function removeCountry() {
    setRemoving(true);
    const paths = data.country_media.map((m) => m.storage_path);
    await supabase.from("visited_countries").delete().eq("id", data.id);
    if (paths.length) await supabase.storage.from("media").remove(paths);
    router.push("/my-world");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-lg">Trip details</h3>
          <p className="text-xs text-muted">Optional — add as much or as little as you like, any time.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleShareToFeed}
            disabled={feedBusy}
            aria-pressed={data.share_to_feed}
            title={data.share_to_feed ? "Visible in followers' feeds" : "Hidden from the feed"}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              data.share_to_feed
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-muted hover:text-accent"
            )}
          >
            <Rss size={13} />
            {data.share_to_feed ? "In feed" : "Not in feed"}
          </button>
          <button
            type="button"
            onClick={toggleFavourite}
            disabled={favouriteBusy}
            aria-pressed={data.is_favourite}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              data.is_favourite
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-muted hover:text-accent"
            )}
          >
            <Heart size={13} className={data.is_favourite ? "fill-accent" : undefined} />
            {data.is_favourite ? "Favourite" : "Mark favourite"}
          </button>
        </div>
      </div>

      {/* Visits — each can have its own highlight, and you can log the same year twice */}
      <section>
        <h4 className="text-sm font-medium text-muted">Your visits</h4>
        {visits.length > 0 && (
          <ul className="mt-2 space-y-2">
            {visits.map((v) => (
              <li key={v.id} className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{formatVisitRange(v)}</p>
                  {v.highlight && <p className="mt-0.5 text-sm text-muted">{v.highlight}</p>}
                </div>
                <button
                  type="button"
                  aria-label={`Remove the ${v.year} visit`}
                  className="shrink-0 text-muted hover:text-red-700"
                  onClick={() => removeVisit(v.id)}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addVisit} className="mt-3 flex flex-wrap items-center gap-1.5">
          <label htmlFor="year-input" className="sr-only">Year</label>
          <input id="year-input" type="number" inputMode="numeric" min={1900} max={2100} placeholder="2024" className="field !w-20 !py-1.5 text-sm" value={year} onChange={(e) => setYear(e.target.value)} />
          <label htmlFor="date-from-input" className="sr-only">From date (optional)</label>
          <input
            id="date-from-input"
            type="date"
            title="From date (optional)"
            className="field !w-[8.5rem] !py-1.5 text-sm"
            value={visitedFrom}
            onChange={(e) => {
              setVisitedFrom(e.target.value);
              if (e.target.value) setYear(e.target.value.slice(0, 4));
            }}
          />
          <label htmlFor="date-to-input" className="sr-only">To date (optional)</label>
          <input
            id="date-to-input"
            type="date"
            title="To date (optional)"
            className="field !w-[8.5rem] !py-1.5 text-sm"
            value={visitedTo}
            onChange={(e) => setVisitedTo(e.target.value)}
          />
          <label htmlFor="highlight-input" className="sr-only">Highlight from this visit</label>
          <input
            id="highlight-input"
            type="text"
            placeholder="Highlight from this trip (optional)"
            className="field !py-1.5 min-w-0 flex-1 text-sm"
            maxLength={200}
            value={highlight}
            onChange={(e) => setHighlight(e.target.value)}
          />
          <button type="submit" className="btn-ghost !px-2.5 !py-1.5 text-sm" aria-label="Add visit"><Plus size={15} /></button>
        </form>
      </section>

      <section>
        <h4 className="text-sm font-medium text-muted">Cities</h4>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {data.country_cities.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm">
              {c.city_name}
              <button type="button" aria-label={`Remove ${c.city_name}`} className="text-muted hover:text-red-700" onClick={() => removeCity(c.id)}>
                <X size={13} />
              </button>
            </span>
          ))}
          <form onSubmit={addCity} className="flex items-center gap-1.5">
            <label htmlFor="city-input" className="sr-only">Add a city</label>
            <input id="city-input" type="text" placeholder="Tallinn" className="field !w-32 !py-1.5 text-sm" value={city} onChange={(e) => setCity(e.target.value)} />
            <button type="submit" className="btn-ghost !px-2.5 !py-1.5 text-sm" aria-label="Add city"><Plus size={15} /></button>
          </form>
        </div>
      </section>

      {/* Note — autosaves on blur */}
      <section>
        <label htmlFor="country-note" className="text-sm font-medium text-muted">The memory</label>
        <textarea
          id="country-note"
          className="field mt-2 min-h-24"
          placeholder={`What should ${meta.name} always remind you of?`}
          value={note}
          maxLength={1000}
          onChange={(e) => {
            setNote(e.target.value);
            setNoteSaved(false);
          }}
          onBlur={saveNoteIfChanged}
        />
        {noteSaved && <span role="status" className="mt-1.5 block text-xs text-accent">Saved.</span>}
      </section>

      {error && <p role="alert" className="text-sm text-red-800 dark:text-red-400">{error}</p>}

      <div className="border-t border-line pt-5">
        <button type="button" className="btn-danger" onClick={() => setConfirmRemove(true)}>
          Remove from my map
        </button>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title={`Remove ${meta.name}?`}
        body="Its years, cities, note and photos will be deleted from your archive. This cannot be undone."
        confirmLabel="Remove country"
        busy={removing}
        onConfirm={removeCountry}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, MapPinPlus, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { VisitedCountryFull } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { cn } from "@/lib/utils";

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
  const [city, setCity] = useState("");
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [favouriteBusy, setFavouriteBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const years = [...data.country_visits].sort((a, b) => a.year - b.year);

  async function addYear(e: React.FormEvent) {
    e.preventDefault();
    const y = parseInt(year, 10);
    if (Number.isNaN(y) || y < 1900 || y > 2100) {
      setError("Enter a year between 1900 and 2100.");
      return;
    }
    setError(null);
    const { error: err } = await supabase
      .from("country_visits")
      .insert({ visited_country_id: data.id, year: y });
    if (err) setError(err.code === "23505" ? `${y} is already on the list.` : "Could not add that year.");
    else {
      setYear("");
      router.refresh();
    }
  }

  async function removeYear(id: string) {
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
        <button
          type="button"
          onClick={toggleFavourite}
          disabled={favouriteBusy}
          aria-pressed={data.is_favourite}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            data.is_favourite
              ? "border-accent bg-accent-soft text-accent"
              : "border-line text-muted hover:text-accent"
          )}
        >
          <Heart size={13} className={data.is_favourite ? "fill-accent" : undefined} />
          {data.is_favourite ? "Favourite" : "Mark favourite"}
        </button>
      </div>

      {/* Years + cities, side by side */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section>
          <h4 className="text-sm font-medium text-muted">Years visited</h4>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {years.map((v) => (
              <span key={v.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm">
                {v.year}
                <button type="button" aria-label={`Remove ${v.year}`} className="text-muted hover:text-red-700" onClick={() => removeYear(v.id)}>
                  <X size={13} />
                </button>
              </span>
            ))}
            <form onSubmit={addYear} className="flex items-center gap-1.5">
              <label htmlFor="year-input" className="sr-only">Add a year</label>
              <input id="year-input" type="number" inputMode="numeric" min={1900} max={2100} placeholder="2024" className="field !w-20 !py-1.5 text-sm" value={year} onChange={(e) => setYear(e.target.value)} />
              <button type="submit" className="btn-ghost !px-2.5 !py-1.5 text-sm" aria-label="Add year"><Plus size={15} /></button>
            </form>
          </div>
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
      </div>

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

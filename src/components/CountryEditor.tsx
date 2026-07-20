"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPinPlus, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { VisitedCountryFull } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";

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
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [year, setYear] = useState("");
  const [city, setCity] = useState("");
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
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

  async function saveNote() {
    setNoteBusy(true);
    setNoteSaved(false);
    await supabase.from("visited_countries").update({ note: note.trim() }).eq("id", data.id);
    setNoteBusy(false);
    setNoteSaved(true);
    router.refresh();
  }

  async function toggleFavourite() {
    await supabase
      .from("visited_countries")
      .update({ is_favourite: !data.is_favourite })
      .eq("id", data.id);
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
    <div className="space-y-8">
      {/* Visit years */}
      <section>
        <h3 className="font-serif text-lg">Years visited</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {years.map((v) => (
            <span key={v.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm">
              {v.year}
              <button type="button" aria-label={`Remove ${v.year}`} className="text-muted hover:text-red-700" onClick={() => removeYear(v.id)}>
                <X size={13} />
              </button>
            </span>
          ))}
          <form onSubmit={addYear} className="flex items-center gap-2">
            <label htmlFor="year-input" className="sr-only">Add a year</label>
            <input id="year-input" type="number" inputMode="numeric" min={1900} max={2100} placeholder="2024" className="field !w-24 !py-1.5 text-sm" value={year} onChange={(e) => setYear(e.target.value)} />
            <button type="submit" className="btn-ghost !px-3 !py-1.5 text-sm" aria-label="Add year"><Plus size={15} /></button>
          </form>
        </div>
      </section>

      {/* Cities */}
      <section>
        <h3 className="font-serif text-lg">Cities</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {data.country_cities.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm">
              {c.city_name}
              <button type="button" aria-label={`Remove ${c.city_name}`} className="text-muted hover:text-red-700" onClick={() => removeCity(c.id)}>
                <X size={13} />
              </button>
            </span>
          ))}
          <form onSubmit={addCity} className="flex items-center gap-2">
            <label htmlFor="city-input" className="sr-only">Add a city</label>
            <input id="city-input" type="text" placeholder="Tallinn" className="field !w-40 !py-1.5 text-sm" value={city} onChange={(e) => setCity(e.target.value)} />
            <button type="submit" className="btn-ghost !px-3 !py-1.5 text-sm" aria-label="Add city"><Plus size={15} /></button>
          </form>
        </div>
      </section>

      {/* Note */}
      <section>
        <label htmlFor="country-note" className="font-serif text-lg">The memory</label>
        <textarea
          id="country-note"
          className="field mt-3 min-h-28"
          placeholder={`What should ${meta.name} always remind you of?`}
          value={note}
          maxLength={1000}
          onChange={(e) => {
            setNote(e.target.value);
            setNoteSaved(false);
          }}
        />
        <div className="mt-2 flex items-center gap-3">
          <button type="button" className="btn-primary !py-2 text-sm" onClick={saveNote} disabled={noteBusy}>
            {noteBusy ? "Saving…" : "Save note"}
          </button>
          {noteSaved && <span role="status" className="text-sm text-accent">Saved.</span>}
        </div>
      </section>

      {/* Favourite */}
      <section className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3">
        <div>
          <p className="text-sm font-medium">Favourite memory</p>
          <p className="text-xs text-muted">Favourites lead the memories section on your profile.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={data.is_favourite}
          aria-label="Show as a favourite memory"
          onClick={toggleFavourite}
          className={`relative h-6 w-11 rounded-full transition-colors ${data.is_favourite ? "bg-accent" : "bg-raised border border-line"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${data.is_favourite ? "left-[1.375rem]" : "left-0.5"}`} />
        </button>
      </section>

      {error && <p role="alert" className="text-sm text-red-800 dark:text-red-400">{error}</p>}

      <div className="border-t border-line pt-6">
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

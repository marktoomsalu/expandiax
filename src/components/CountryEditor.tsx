"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronRight, Lock, MapPinPlus, MessageSquareText, Plus, Rss, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { enqueueUploads } from "@/lib/uploadQueue";
import { suggestTripName } from "@/lib/tripPlaces";
import { PHOTO_CAP, VIDEO_CAP } from "@/lib/plan";
import { PendingMediaPicker, type PendingItem } from "./PendingMediaPicker";
import type { DatePrecision, TripKind, VisitedCountryFull } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { StayRow, type StayView } from "./StayRow";
import { TripKindToggle } from "./TripKindToggle";
import { SuggestedDatesNote, usePhotoDateRange, useSuggestedDates } from "./PhotoDateSuggestion";
import { SuggestedNameNote, SuggestedPlacesField, savePlaces, useBestCover, usePhotoPlaces } from "./PhotoPlaceSuggestion";
import { VisitDateFields } from "./VisitDateFields";
import { cn } from "@/lib/utils";
import { tapSuccess } from "@/lib/haptics";

type Meta = { code: string; name: string; flag: string; capital: string };

// Shared by both "first trip to a country" and "add another trip" below:
// hands the chosen photos and videos to the background upload queue, so the
// trip opens straight away and they follow — each under its place, and the
// best landscape photo as the trip's cover.
function queuePendingMedia(opts: {
  userId: string;
  visitedCountryId: string;
  visitId: string;
  media: PendingItem[];
  videoQuality: "standard" | "hd";
  /** The trip place each photo was taken at, if known. */
  placeOf?: (file: File) => string | undefined;
  cover?: File;
}) {
  const { userId, visitedCountryId, visitId, media, videoQuality, placeOf, cover } = opts;
  enqueueUploads(
    media.map((p, i) => {
      const cityId = placeOf?.(p.file);
      return {
        file: p.file,
        kind: p.kind,
        target: {
          userId,
          scope: "countries" as const,
          parentId: visitId,
          table: "country_media" as const,
          fields: { visited_country_id: visitedCountryId, country_visit_id: visitId, ...(cityId ? { city_id: cityId } : {}) },
          displayOrder: i,
          videoQuality,
          cover: p.file === cover ? { table: "country_visits" as const, id: visitId } : undefined,
        },
      };
    })
  );
}

/** First trip to a new country — bundles marking it visited with its first
 *  visit (dates + memory + photos/video) in one step. */
export function AddCountryForm({ meta }: { meta: Meta }) {
  const router = useRouter();
  const supabase = createClient();
  const [precision, setPrecision] = useState<DatePrecision>("year");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [visitedFrom, setVisitedFrom] = useState("");
  const [visitedTo, setVisitedTo] = useState("");
  const [highlight, setHighlight] = useState("");
  const [kind, setKind] = useState<TripKind>("trip");
  const [title, setTitle] = useState("");
  const [pendingMedia, setPendingMedia] = useState<PendingItem[]>([]);
  // When the chosen photos were taken (read on the device) fills the dates by
  // itself, marked as a suggestion, until the person changes them.
  const photoRange = usePhotoDateRange(pendingMedia.filter((p) => p.kind === "image").map((p) => p.file));
  const dates = useSuggestedDates(photoRange, { precision, year, visitedFrom, visitedTo, setPrecision, setYear, setVisitedFrom, setVisitedTo });
  // …and where they were taken suggests the trip's places, each with its own days.
  const photoFiles = pendingMedia.filter((p) => p.kind === "image").map((p) => p.file);
  const foundPlaces = usePhotoPlaces(photoFiles, meta.code);
  const [leftOut, setLeftOut] = useState<string[]>([]);
  const places = foundPlaces.filter((p) => !leftOut.includes(p.key));
  // Until they type a name, the trip is named after its places.
  const [titleTouched, setTitleTouched] = useState(false);
  const shownTitle = titleTouched ? title : suggestTripName(kind, places.map((p) => p.name), meta.name);
  const coverIndex = useBestCover(photoFiles);
  const [videoQuality, setVideoQuality] = useState<"standard" | "hd">("standard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const y = parseInt(year, 10);
    if (Number.isNaN(y) || y < 1900 || y > 2100) {
      setError("Enter a year between 1900 and 2100.");
      return;
    }
    if (precision === "day" && visitedFrom && visitedTo && visitedTo < visitedFrom) {
      setError("The \"to\" date can't be before the \"from\" date.");
      return;
    }
    if (precision === "month" && !month) {
      setError("Choose a month.");
      return;
    }
    setError(null);
    setBusy(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Your session expired. Please sign in again.");
      setBusy(false);
      return;
    }

    const { data: country, error: countryErr } = await supabase
      .from("visited_countries")
      .insert({ user_id: user.id, country_code: meta.code, country_name: meta.name })
      .select("id")
      .single();
    if (countryErr || !country) {
      if (countryErr?.code === "23505") {
        setError(`${meta.name} is already on your map.`);
      } else {
        setError("Could not add this country. Try again.");
      }
      setBusy(false);
      return;
    }

    let from: string | null = null;
    let to: string | null = null;
    let datePrecision: DatePrecision = "year";
    if (precision === "day" && visitedFrom) {
      from = visitedFrom;
      to = visitedTo || visitedFrom;
      datePrecision = "day";
    } else if (precision === "month" && month) {
      const lastDay = new Date(y, Number(month), 0).getDate();
      from = `${year}-${month}-01`;
      to = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
      datePrecision = "month";
    }

    const { data: visit, error: visitErr } = await supabase
      .from("country_visits")
      .insert({
        visited_country_id: country.id,
        year: y,
        visited_from: from,
        visited_to: to,
        date_precision: datePrecision,
        highlight: highlight.trim(),
        title: titleTouched ? title.trim().slice(0, 80) : "",
        kind,
      })
      .select("id")
      .single();
    if (visitErr || !visit) {
      // The country itself was added fine — just send them to its page to
      // retry the trip, rather than losing the country too.
      router.push(`/my-world/${meta.code.toLowerCase()}`);
      router.refresh();
      return;
    }

    const placeIds = await savePlaces(supabase, { visitedCountryId: country.id, visitId: visit.id, places });
    queuePendingMedia({
      userId: user.id,
      visitedCountryId: country.id,
      visitId: visit.id,
      media: pendingMedia,
      videoQuality,
      cover: photoFiles[coverIndex] ?? photoFiles[0],
      placeOf: (file) => placeIds.get(places.find((pl) => pl.photos.some((i) => photoFiles[i] === file))?.key ?? ""),
    });

    tapSuccess();
    router.push(`/my-world/${meta.code.toLowerCase()}/visits/${visit.id}?created=1`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-6 text-left">
      <div>
        <TripKindToggle value={kind} onChange={setKind} />
        <label htmlFor="first-title" className="sr-only">Name (optional)</label>
        <input
          id="first-title"
          type="text"
          className="field mt-2 !py-1.5 w-full"
          maxLength={80}
          placeholder={kind === "lived" ? "Name - optional, e.g. My Ljubljana years" : `Name - optional, e.g. ${meta.name} Road Trip`}
          value={shownTitle}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleTouched(true);
          }}
        />
        {!titleTouched && shownTitle && <SuggestedNameNote />}
      </div>
      <div className="border-t border-line pt-5">
        <p className="eyebrow mb-3">Photos & videos</p>
        <PendingMediaPicker items={pendingMedia} onChange={setPendingMedia} photoCap={PHOTO_CAP} videoCap={VIDEO_CAP} />
        {pendingMedia.some((p) => p.kind === "video") && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted">Video upload quality</span>
            <div className="flex gap-1.5">
              {(["standard", "hd"] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setVideoQuality(q)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    videoQuality === q ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"
                  )}
                >
                  {q === "standard" ? "Standard - faster" : "HD - original"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-line pt-5">
        <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"><Calendar size={14} className="text-accent" aria-hidden /> When</span>
        <VisitDateFields
          precision={precision}
          onPrecisionChange={dates.setPrecision}
          year={year}
          onYearChange={dates.setYear}
          month={month}
          onMonthChange={setMonth}
          visitedFrom={visitedFrom}
          onVisitedFromChange={dates.setVisitedFrom}
          visitedTo={visitedTo}
          onVisitedToChange={dates.setVisitedTo}
        />
        {dates.suggested && <SuggestedDatesNote />}
      </div>
      <SuggestedPlacesField places={places} onRemove={(key) => setLeftOut((cur) => [...cur, key])} />
      <div className="border-t border-line pt-5">
        <label htmlFor="first-highlight" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
          <MessageSquareText size={14} className="text-accent" aria-hidden /> A quick memory
        </label>
        <input
          id="first-highlight"
          type="text"
          placeholder="Optional - add more after"
          className="field !py-1.5 w-full"
          maxLength={1000}
          value={highlight}
          onChange={(e) => setHighlight(e.target.value)}
        />
      </div>
      <button type="submit" className="btn-accent w-full justify-center" disabled={busy}>
        <MapPinPlus size={17} />
        {busy ? "Adding…" : `Add ${meta.name} to your map`}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-800 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}


export function CountryEditor({ data, meta, trips }: { data: VisitedCountryFull; meta: Meta; trips: StayView[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [precision, setPrecision] = useState<DatePrecision>("year");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [visitedFrom, setVisitedFrom] = useState("");
  const [visitedTo, setVisitedTo] = useState("");
  const [highlight, setHighlight] = useState("");
  const [kind, setKind] = useState<TripKind>("trip");
  const [title, setTitle] = useState("");
  const [pendingMedia, setPendingMedia] = useState<PendingItem[]>([]);
  // When the chosen photos were taken (read on the device) fills the dates by
  // itself, marked as a suggestion, until the person changes them.
  const photoRange = usePhotoDateRange(pendingMedia.filter((p) => p.kind === "image").map((p) => p.file));
  const dates = useSuggestedDates(photoRange, { precision, year, visitedFrom, visitedTo, setPrecision, setYear, setVisitedFrom, setVisitedTo });
  // …and where they were taken suggests the trip's places, each with its own days.
  const photoFiles = pendingMedia.filter((p) => p.kind === "image").map((p) => p.file);
  const foundPlaces = usePhotoPlaces(photoFiles, meta.code);
  const [leftOut, setLeftOut] = useState<string[]>([]);
  const places = foundPlaces.filter((p) => !leftOut.includes(p.key));
  // Until they type a name, the trip is named after its places.
  const [titleTouched, setTitleTouched] = useState(false);
  const shownTitle = titleTouched ? title : suggestTripName(kind, places.map((p) => p.name), meta.name);
  const coverIndex = useBestCover(photoFiles);
  const [videoQuality, setVideoQuality] = useState<"standard" | "hd">("standard");
  const [addingVisit, setAddingVisit] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [adding, setAdding] = useState(trips.length === 0);
  const [feedBusy, setFeedBusy] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addVisit(e: React.FormEvent) {
    e.preventDefault();
    const y = parseInt(year, 10);
    if (Number.isNaN(y) || y < 1900 || y > 2100) {
      setError("Enter a year between 1900 and 2100.");
      return;
    }
    if (precision === "day" && visitedFrom && visitedTo && visitedTo < visitedFrom) {
      setError("The \"to\" date can't be before the \"from\" date.");
      return;
    }
    if (precision === "month" && !month) {
      setError("Choose a month.");
      return;
    }
    setError(null);
    setAddingVisit(true);

    let from: string | null = null;
    let to: string | null = null;
    let datePrecision: DatePrecision = "year";

    if (precision === "day" && visitedFrom) {
      from = visitedFrom;
      to = visitedTo || visitedFrom;
      datePrecision = "day";
    } else if (precision === "month" && month) {
      const lastDay = new Date(y, Number(month), 0).getDate();
      from = `${year}-${month}-01`;
      to = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
      datePrecision = "month";
    }

    const { data: inserted, error: err } = await supabase
      .from("country_visits")
      .insert({
        visited_country_id: data.id,
        year: y,
        visited_from: from,
        visited_to: to,
        date_precision: datePrecision,
        highlight: highlight.trim(),
        title: titleTouched ? title.trim().slice(0, 80) : "",
        kind,
      })
      .select("id")
      .single();
    if (err || !inserted) {
      setError("Could not add that visit.");
      setAddingVisit(false);
      return;
    }

    const placeIds = await savePlaces(supabase, { visitedCountryId: data.id, visitId: inserted.id, places });
    queuePendingMedia({
      userId: data.user_id,
      visitedCountryId: data.id,
      visitId: inserted.id,
      media: pendingMedia,
      videoQuality,
      cover: photoFiles[coverIndex] ?? photoFiles[0],
      placeOf: (file) => placeIds.get(places.find((pl) => pl.photos.some((i) => photoFiles[i] === file))?.key ?? ""),
    });

    tapSuccess();
    router.push(`/my-world/${meta.code.toLowerCase()}/visits/${inserted.id}?created=1`);
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

  // "Only me": this country disappears for everyone else — map, counts,
  // feed, comments — while the rest of the profile stays as it is.
  async function toggleOnlyMe() {
    setPrivacyBusy(true);
    await supabase
      .from("visited_countries")
      .update({ is_public: !data.is_public })
      .eq("id", data.id);
    setPrivacyBusy(false);
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

  function openAddTrip() {
    setAdding(true);
    requestAnimationFrame(() => document.getElementById("add-trip")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const pill = "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors";
  return (
    <div className="space-y-10">
      {/* Trips — each carries its own photos, soundtrack and memory */}
      <section aria-labelledby="trips-h">
        <div className="flex items-center justify-between gap-4">
          <h2 id="trips-h" className="font-serif text-2xl">All stays & trips</h2>
          <button type="button" onClick={openAddTrip} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            <Plus size={16} aria-hidden /> Add
          </button>
        </div>

        {trips.length > 0 && (
          <ol className="mt-4">
            {trips.map((t, i) => (
              <li key={t.id}>
                <StayRow stay={t} href={`/my-world/${meta.code.toLowerCase()}/visits/${t.id}`} first={i === 0} last={i === trips.length - 1} />
              </li>
            ))}
          </ol>
        )}

        {!adding ? (
          <button
            type="button"
            onClick={openAddTrip}
            className="mt-4 flex w-full items-center gap-3.5 rounded-2xl border border-dashed border-line px-4 py-4 text-left transition-colors hover:border-accent"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/50 text-accent">
              <Plus size={18} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Add a trip or stay in {meta.name}</span>
              <span className="block text-xs text-muted">Another trip, or a time you lived here.</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
          </button>
        ) : (
          <form id="add-trip" onSubmit={addVisit} className="mt-4 scroll-mt-6 space-y-6 rounded-2xl border border-line bg-surface px-5 py-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 font-serif text-xl">
                <Plus size={18} className="text-accent" aria-hidden /> {trips.length ? `Another trip or stay in ${meta.name}` : `Your first trip to ${meta.name}`}
              </p>
              {trips.length > 0 && (
                <button type="button" onClick={() => setAdding(false)} aria-label="Close" className="text-muted hover:text-ink">
                  <X size={18} />
                </button>
              )}
            </div>
            <div>
              <TripKindToggle value={kind} onChange={setKind} />
              <label htmlFor="add-title" className="sr-only">Name (optional)</label>
              <input
                id="add-title"
                type="text"
                className="field mt-2 !py-1.5 w-full"
                maxLength={80}
                placeholder={kind === "lived" ? "Name - optional, e.g. My Ljubljana years" : `Name - optional, e.g. ${meta.name} Road Trip`}
                value={shownTitle}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleTouched(true);
                }}
              />
              {!titleTouched && shownTitle && <SuggestedNameNote />}
            </div>
            <div className="border-t border-line pt-5">
              <p className="eyebrow mb-3">Photos & videos</p>
              <PendingMediaPicker items={pendingMedia} onChange={setPendingMedia} photoCap={PHOTO_CAP} videoCap={VIDEO_CAP} />
              {pendingMedia.some((p) => p.kind === "video") && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-muted">Video upload quality</span>
                  <div className="flex gap-1.5">
                    {(["standard", "hd"] as const).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setVideoQuality(q)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                          videoQuality === q ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"
                        )}
                      >
                        {q === "standard" ? "Standard - faster" : "HD - original"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-line pt-5">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"><Calendar size={14} className="text-accent" aria-hidden /> When</span>
              <VisitDateFields
                precision={precision}
                onPrecisionChange={dates.setPrecision}
                year={year}
                onYearChange={dates.setYear}
                month={month}
                onMonthChange={setMonth}
                visitedFrom={visitedFrom}
                onVisitedFromChange={dates.setVisitedFrom}
                visitedTo={visitedTo}
                onVisitedToChange={dates.setVisitedTo}
              />
              {dates.suggested && <SuggestedDatesNote />}
            </div>
            <SuggestedPlacesField places={places} onRemove={(key) => setLeftOut((cur) => [...cur, key])} />
            <div className="border-t border-line pt-5">
              <label htmlFor="highlight-input" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                <MessageSquareText size={14} className="text-accent" aria-hidden /> A quick memory
              </label>
              <input
                id="highlight-input"
                type="text"
                placeholder="Optional - add more on its page after"
                className="field !py-1.5 w-full"
                maxLength={1000}
                value={highlight}
                onChange={(e) => setHighlight(e.target.value)}
              />
            </div>
            {error && <p role="alert" className="text-sm text-red-800 dark:text-red-400">{error}</p>}
            <button type="submit" className="btn-accent w-full justify-center !py-2.5 text-sm" disabled={addingVisit}>
              <Plus size={15} /> {addingVisit ? "Adding…" : kind === "lived" ? "Add this stay" : "Add this trip"}
            </button>
          </form>
        )}
      </section>

      {/* Who sees it, and the way out */}
      <section aria-labelledby="settings-h" className="card px-5 py-5">
        <h2 id="settings-h" className="font-serif text-lg">{meta.name} settings</h2>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Who can see it</p>
              <p className="text-xs text-muted">
                {data.is_public ? "Everyone who can see your profile." : "Only you - hidden from everyone else."}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleOnlyMe}
              disabled={privacyBusy}
              aria-pressed={!data.is_public}
              className={cn(pill, !data.is_public ? "border-ink bg-ink text-canvas" : "border-line text-muted hover:text-accent")}
            >
              <Lock size={13} />
              {data.is_public ? "Visible" : "Only me"}
            </button>
          </div>
          {data.is_public && (
            <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">In your followers&rsquo; feeds</p>
                <p className="text-xs text-muted">New trips and photos show up for people who follow you.</p>
              </div>
              <button
                type="button"
                onClick={toggleShareToFeed}
                disabled={feedBusy}
                aria-pressed={data.share_to_feed}
                className={cn(pill, data.share_to_feed ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-accent")}
              >
                <Rss size={13} />
                {data.share_to_feed ? "In feed" : "Not in feed"}
              </button>
            </div>
          )}
          <div className="border-t border-line pt-4">
            <button type="button" className="text-sm font-medium text-red-700 hover:underline dark:text-red-400" onClick={() => setConfirmRemove(true)}>
              Remove {meta.name} from my map
            </button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirmRemove}
        title={`Remove ${meta.name}?`}
        body="Its trips, cities and photos will be deleted from your archive. This cannot be undone."
        confirmLabel="Remove country"
        busy={removing}
        onConfirm={removeCountry}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}

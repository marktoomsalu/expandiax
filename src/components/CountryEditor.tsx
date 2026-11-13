"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { newDraftId, useDraft, useDraftFiles } from "@/lib/drafts";
import { DraftRestored, DraftsList } from "./Drafts";
import { Calendar, ChevronRight, MapPinPlus, MessageSquareText, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { enqueueUploads } from "@/lib/uploadQueue";
import { byTimeTaken } from "@/lib/photoDates";
import { suggestTripName } from "@/lib/tripPlaces";
import { PHOTO_CAP, VIDEO_CAP } from "@/lib/plan";
import { PendingMediaPicker, type PendingItem } from "./PendingMediaPicker";
import type { DatePrecision, TripKind, VisitedCountryFull } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { StayRow, type StayView } from "./StayRow";
import { AudiencePicker } from "./AudiencePicker";
import type { Audience } from "@/lib/audience";
import { TripKindToggle } from "./TripKindToggle";
import { SuggestedDatesNote, usePhotoDateRange, useSuggestedDates } from "./PhotoDateSuggestion";
import { SuggestedNameNote, SuggestedPlacesField, savePlaces, useBestCover, usePhotoPlaces } from "./PhotoPlaceSuggestion";
import { VisitDateFields } from "./VisitDateFields";
import { cn } from "@/lib/utils";
import { tapSuccess } from "@/lib/haptics";
import { askForPush } from "@/lib/pushAsk";

type Meta = { code: string; name: string; flag: string; capital: string };

// A trip being added is kept on this device as it's written (lib/drafts):
// leaving the app or a failed upload never loses it, and "Save as draft"
// keeps it for later. Each new trip has its own draft (?draft=…).
type TripDraftFields = {
  precision: DatePrecision;
  year: string;
  month: string;
  visitedFrom: string;
  visitedTo: string;
  highlight: string;
  audience: Audience;
  kind: TripKind;
  ongoing: boolean;
  title: string;
  titleTouched: boolean;
};

function useTripDraft(
  scope: "trip-new" | "trip-add",
  meta: Meta,
  fields: TripDraftFields,
  files: PendingItem[],
  apply: (d: TripDraftFields) => void,
  setFiles: (items: PendingItem[]) => void
) {
  const params = useSearchParams();
  const [draftId] = useState(() => params.get("draft") ?? newDraftId());
  const key = `${scope}:${meta.code}:${draftId}`;
  const hasContent = !!(fields.highlight.trim() || (fields.titleTouched && fields.title.trim()) || fields.year || fields.visitedFrom || files.length);
  const draft = useDraft({
    meta: {
      key,
      kind: "trip",
      title: (fields.titleTouched && fields.title.trim()) || `${fields.kind === "lived" ? "A stay" : "A trip"} in ${meta.name}`,
      href: `/my-world/${meta.code.toLowerCase()}?draft=${draftId}#${scope === "trip-new" ? "add" : "add-trip"}`,
      files: files.length,
    },
    value: fields,
    hasContent,
    restore: apply,
  });
  useDraftFiles(key, files, (found) => setFiles(found.map((x) => ({ ...x, previewUrl: URL.createObjectURL(x.file) }))));
  useEffect(() => {
    if (!hasContent || params.get("draft")) return;
    const url = new URL(window.location.href);
    url.searchParams.set("draft", draftId);
    window.history.replaceState(window.history.state, "", url);
  }, [hasContent, params, draftId]);
  return { draft, hasContent };
}

// Shared by both "first trip to a country" and "add another trip" below:
// hands the chosen photos and videos to the background upload queue, so the
// trip opens straight away and they follow — each under its place, and the
// best landscape photo as the trip's cover.
async function queuePendingMedia(opts: {
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
  // In the order they were taken.
  const ordered = await byTimeTaken(media);
  enqueueUploads(
    ordered.map((p, i) => {
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
          takenAt: p.takenAt,
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
  const [audience, setAudience] = useState<Audience>("everyone");
  const [kind, setKind] = useState<TripKind>("trip");
  // "I still live here" (only for a stay): a start date and no end.
  const [ongoing, setOngoing] = useState(false);
  const current = kind === "lived" && ongoing;
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
  const shownTitle = titleTouched ? title : suggestTripName(kind, places.map((p) => p.name), meta.name, current);
  const coverIndex = useBestCover(photoFiles);
  const { draft, hasContent } = useTripDraft(
    "trip-new",
    meta,
    { precision, year, month, visitedFrom, visitedTo, highlight, audience, kind, ongoing, title, titleTouched },
    pendingMedia,
    (d) => {
      setPrecision(d.precision);
      setYear(d.year);
      setMonth(d.month);
      setVisitedFrom(d.visitedFrom);
      setVisitedTo(d.visitedTo);
      setHighlight(d.highlight);
      setAudience(d.audience);
      setKind(d.kind);
      setOngoing(d.ongoing);
      setTitle(d.title);
      setTitleTouched(d.titleTouched);
    },
    setPendingMedia
  );
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
      to = current ? null : visitedTo || visitedFrom;
      datePrecision = "day";
    } else if (precision === "month" && month) {
      const lastDay = new Date(y, Number(month), 0).getDate();
      from = `${year}-${month}-01`;
      to = current ? null : `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
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
        ...(audience !== "everyone" ? { audience } : {}),
        // Only sent when on, so adding works before migration 074 too.
        ...(current ? { is_current: true } : {}),
      })
      .select("id")
      .single();
    if (!visitErr && visit) askForPush("memory", 2500);
    if (visitErr || !visit) {
      // The country itself was added fine — just send them to its page to
      // retry the trip, rather than losing the country too.
      router.push(`/my-world/${meta.code.toLowerCase()}`);
      router.refresh();
      return;
    }

    const placeIds = await savePlaces(supabase, { visitedCountryId: country.id, visitId: visit.id, places });
    void queuePendingMedia({
      userId: user.id,
      visitedCountryId: country.id,
      visitId: visit.id,
      media: pendingMedia,
      videoQuality,
      cover: photoFiles[coverIndex] ?? photoFiles[0],
      placeOf: (file) => placeIds.get(places.find((pl) => pl.photos.some((i) => photoFiles[i] === file))?.key ?? ""),
    });

    draft.discard();
    tapSuccess();
    router.push(`/my-world/${meta.code.toLowerCase()}/visits/${visit.id}?created=1`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-6 text-left">
      {draft.restoredAt && <DraftRestored at={draft.restoredAt} onDiscard={() => { draft.discard(); window.location.href = `/my-world/${meta.code.toLowerCase()}`; }} />}
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
      <div>
        <p className="eyebrow mb-2">Who can see it</p>
        <AudiencePicker value={audience} onChange={setAudience} />
      </div>
      <div className="border-t border-line pt-5">
        <p className="eyebrow mb-3">Photos & videos</p>
        <PendingMediaPicker items={pendingMedia} onChange={setPendingMedia} photoCap={PHOTO_CAP} videoCap={VIDEO_CAP} videoQuality={videoQuality} />
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
          ongoing={current}
          onOngoingChange={kind === "lived" ? setOngoing : undefined}
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
      <button
        type="button"
        className="btn-ghost -mt-3 w-full justify-center"
        disabled={busy || !hasContent}
        onClick={() => {
          draft.saveNow();
          router.push("/my-world");
        }}
      >
        Save as draft
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-800 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}


/** `afterTrips`: shown right below "All stays & trips" (the country page puts its places there). */
export function CountryEditor({ data, meta, trips, afterTrips }: { data: VisitedCountryFull; meta: Meta; trips: StayView[]; afterTrips?: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();
  const [precision, setPrecision] = useState<DatePrecision>("year");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [visitedFrom, setVisitedFrom] = useState("");
  const [visitedTo, setVisitedTo] = useState("");
  const [highlight, setHighlight] = useState("");
  const [audience, setAudience] = useState<Audience>("everyone");
  const [kind, setKind] = useState<TripKind>("trip");
  // "I still live here" (only for a stay): a start date and no end.
  const [ongoing, setOngoing] = useState(false);
  const current = kind === "lived" && ongoing;
  const [adding, setAdding] = useState(trips.length === 0);
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
  const shownTitle = titleTouched ? title : suggestTripName(kind, places.map((p) => p.name), meta.name, current);
  const coverIndex = useBestCover(photoFiles);
  const { draft, hasContent } = useTripDraft(
    "trip-add",
    meta,
    { precision, year, month, visitedFrom, visitedTo, highlight, audience, kind, ongoing, title, titleTouched },
    pendingMedia,
    (d) => {
      setPrecision(d.precision);
      setYear(d.year);
      setMonth(d.month);
      setVisitedFrom(d.visitedFrom);
      setVisitedTo(d.visitedTo);
      setHighlight(d.highlight);
      setAudience(d.audience);
      setKind(d.kind);
      setOngoing(d.ongoing);
      setTitle(d.title);
      setTitleTouched(d.titleTouched);
      setAdding(true);
    },
    setPendingMedia
  );
  const [videoQuality, setVideoQuality] = useState<"standard" | "hd">("standard");
  const [addingVisit, setAddingVisit] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
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
      to = current ? null : visitedTo || visitedFrom;
      datePrecision = "day";
    } else if (precision === "month" && month) {
      const lastDay = new Date(y, Number(month), 0).getDate();
      from = `${year}-${month}-01`;
      to = current ? null : `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
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
        // "everyone" is the column's default, so it's only sent when it differs.
        ...(audience !== "everyone" ? { audience } : {}),
        ...(current ? { is_current: true } : {}),
      })
      .select("id")
      .single();
    if (!err && inserted) askForPush("memory");
    if (err || !inserted) {
      setError("Could not add that visit.");
      setAddingVisit(false);
      return;
    }

    const placeIds = await savePlaces(supabase, { visitedCountryId: data.id, visitId: inserted.id, places });
    void queuePendingMedia({
      userId: data.user_id,
      visitedCountryId: data.id,
      visitId: inserted.id,
      media: pendingMedia,
      videoQuality,
      cover: photoFiles[coverIndex] ?? photoFiles[0],
      placeOf: (file) => placeIds.get(places.find((pl) => pl.photos.some((i) => photoFiles[i] === file))?.key ?? ""),
    });

    draft.discard();
    tapSuccess();
    router.push(`/my-world/${meta.code.toLowerCase()}/visits/${inserted.id}?created=1`);
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

        <DraftsList kind="trip" match={`:${meta.code}:`} className="mt-4" />

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
            {draft.restoredAt && <DraftRestored at={draft.restoredAt} onDiscard={() => { draft.discard(); window.location.href = `/my-world/${meta.code.toLowerCase()}`; }} />}
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
            <div>
              <p className="eyebrow mb-2">Who can see it</p>
              <AudiencePicker value={audience} onChange={setAudience} />
            </div>
            <div className="border-t border-line pt-5">
              <p className="eyebrow mb-3">Photos & videos</p>
              <PendingMediaPicker items={pendingMedia} onChange={setPendingMedia} photoCap={PHOTO_CAP} videoCap={VIDEO_CAP} videoQuality={videoQuality} />
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
                ongoing={current}
                onOngoingChange={kind === "lived" ? setOngoing : undefined}
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
            <button
              type="button"
              className="btn-ghost -mt-3 w-full justify-center !py-2 text-sm"
              disabled={addingVisit || !hasContent}
              onClick={() => {
                draft.saveNow();
                setAdding(false);
              }}
            >
              Save as draft
            </button>
          </form>
        )}
      </section>

      {afterTrips}

      {/* Left from when a whole country could be hidden: now each trip chooses
          for itself, so the country can only be shown again. */}
      {!data.is_public && (
        <div className="card flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Hidden from everyone</p>
            <p className="text-xs text-muted">
              {meta.name} is hidden from your map for others. Show it, then choose &ldquo;Only me&rdquo; on the trips you want to keep to yourself.
            </p>
          </div>
          <button type="button" onClick={toggleOnlyMe} disabled={privacyBusy} className={cn(pill, "border-accent bg-accent-soft text-accent")}>
            Show {meta.name}
          </button>
        </div>
      )}

      {/* Who sees each trip, and whether it's in feeds, is set on the trip (its … menu). The way out stays here. */}
      <div className="border-t border-line pt-5 text-center">
        <button type="button" className="text-sm font-medium text-red-700 hover:underline dark:text-red-400" onClick={() => setConfirmRemove(true)}>
          Remove {meta.name} from my map
        </button>
      </div>

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

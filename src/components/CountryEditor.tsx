"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar, Camera, ChevronRight, Heart, MapPinPlus, MessageSquareText, Music2, Plus, Rss, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadMediaItem } from "@/lib/media";
import { PHOTO_CAP, VIDEO_CAP } from "@/lib/plan";
import { PendingMediaPicker, type PendingItem } from "./PendingMediaPicker";
import type { DatePrecision, Plan, VisitedCountryFull } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { VisitDateFields } from "./VisitDateFields";
import { cn, formatVisitRange, visitSortKey } from "@/lib/utils";
import { tapSuccess } from "@/lib/haptics";

type Meta = { code: string; name: string; flag: string; capital: string };

// Shared by both "first trip to a country" and "add another trip" below —
// uploads whatever's pending in sequence via uploadMediaItem, reporting a
// simple aggregate status string for the submit button.
async function uploadPendingMedia(
  supabase: ReturnType<typeof createClient>,
  opts: {
    userId: string;
    visitedCountryId: string;
    visitId: string;
    media: PendingItem[];
    videoQuality: "standard" | "hd";
    onStatus: (status: string | null) => void;
  }
) {
  const { userId, visitedCountryId, visitId, media, videoQuality, onStatus } = opts;
  const extraFields = { visited_country_id: visitedCountryId, country_visit_id: visitId };

  let done = 0;
  for (const p of media) {
    onStatus(`Uploading ${done + 1} of ${media.length}…`);
    await uploadMediaItem(supabase, {
      userId,
      scope: "countries",
      parentId: visitId,
      file: p.file,
      kind: p.kind,
      table: "country_media",
      extraFields,
      displayOrder: done,
      videoQuality,
      onProgress:
        p.kind === "video"
          ? (pct, phase) => onStatus(`${phase === "compressing" ? "Compressing" : "Uploading"} video ${done + 1} of ${media.length} (${pct}%)…`)
          : undefined,
    }).catch(() => {
      // Best-effort — the trip itself is already saved either way.
    });
    done++;
  }
  onStatus(null);
}

/** First trip to a new country — bundles marking it visited with its first
 *  visit (dates + memory + photos/video) in one step. */
export function AddCountryForm({ meta, plan }: { meta: Meta; plan: Plan }) {
  const router = useRouter();
  const supabase = createClient();
  const [precision, setPrecision] = useState<DatePrecision>("year");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [visitedFrom, setVisitedFrom] = useState("");
  const [visitedTo, setVisitedTo] = useState("");
  const [highlight, setHighlight] = useState("");
  const [pendingMedia, setPendingMedia] = useState<PendingItem[]>([]);
  const [videoQuality, setVideoQuality] = useState<"standard" | "hd">("standard");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
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
      } else if (countryErr?.message.includes("capped at")) {
        setError(countryErr.message);
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

    await uploadPendingMedia(supabase, {
      userId: user.id,
      visitedCountryId: country.id,
      visitId: visit.id,
      media: pendingMedia,
      videoQuality,
      onStatus: setUploadStatus,
    });

    tapSuccess();
    router.push(`/my-world/${meta.code.toLowerCase()}/visits/${visit.id}?created=1`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-6 text-left">
      <div>
        <p className="eyebrow mb-3">Photos & videos</p>
        <PendingMediaPicker items={pendingMedia} onChange={setPendingMedia} photoCap={PHOTO_CAP[plan]} videoCap={VIDEO_CAP[plan]} />
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
          onPrecisionChange={setPrecision}
          year={year}
          onYearChange={setYear}
          month={month}
          onMonthChange={setMonth}
          visitedFrom={visitedFrom}
          onVisitedFromChange={setVisitedFrom}
          visitedTo={visitedTo}
          onVisitedToChange={setVisitedTo}
        />
      </div>
      <div className="border-t border-line pt-5">
        <label htmlFor="first-highlight" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
          <MessageSquareText size={14} className="text-accent" aria-hidden /> A quick memory
        </label>
        <input
          id="first-highlight"
          type="text"
          placeholder="Optional - add more after"
          className="field !py-1.5 w-full text-sm"
          maxLength={1000}
          value={highlight}
          onChange={(e) => setHighlight(e.target.value)}
        />
      </div>
      <button type="submit" className="btn-accent w-full justify-center" disabled={busy}>
        <MapPinPlus size={17} />
        {busy ? uploadStatus ?? "Adding…" : `Add ${meta.name} to your map`}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-800 dark:text-red-400">
          {error}
          {error.includes("capped at") && (
            <>
              {" "}
              <Link href="/settings/billing" className="text-accent underline-offset-4 hover:underline">
                Upgrade to Premium
              </Link>
              .
            </>
          )}
        </p>
      )}
    </form>
  );
}

export function CountryEditor({ data, meta, plan }: { data: VisitedCountryFull; meta: Meta; plan: Plan }) {
  const router = useRouter();
  const supabase = createClient();
  const [precision, setPrecision] = useState<DatePrecision>("year");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [visitedFrom, setVisitedFrom] = useState("");
  const [visitedTo, setVisitedTo] = useState("");
  const [highlight, setHighlight] = useState("");
  const [pendingMedia, setPendingMedia] = useState<PendingItem[]>([]);
  const [videoQuality, setVideoQuality] = useState<"standard" | "hd">("standard");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [addingVisit, setAddingVisit] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [favouriteBusy, setFavouriteBusy] = useState(false);
  const [feedBusy, setFeedBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visits = [...data.country_visits].sort((a, b) => visitSortKey(b).localeCompare(visitSortKey(a)));

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
      })
      .select("id")
      .single();
    if (err || !inserted) {
      setError("Could not add that visit.");
      setAddingVisit(false);
      return;
    }

    await uploadPendingMedia(supabase, {
      userId: data.user_id,
      visitedCountryId: data.id,
      visitId: inserted.id,
      media: pendingMedia,
      videoQuality,
      onStatus: setUploadStatus,
    });

    tapSuccess();
    router.push(`/my-world/${meta.code.toLowerCase()}/visits/${inserted.id}?created=1`);
    router.refresh();
  }

  async function removeVisit(id: string) {
    await supabase.from("country_visits").delete().eq("id", id);
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
          <p className="text-xs text-muted">Optional - add as much or as little as you like, any time.</p>
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

      {/* Visits — each trip carries its own photos, soundtrack and memory */}
      <section>
        <h4 className="font-serif text-lg">Your trips</h4>
        {visits.length > 0 && (
          <ul className="mt-3 space-y-2">
            {visits.map((v) => {
              const photoCount = data.country_media.filter((m) => m.country_visit_id === v.id).length;
              return (
                <li key={v.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2.5">
                  <Link href={`/my-world/${meta.code.toLowerCase()}/visits/${v.id}`} className="group min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium group-hover:text-accent">
                      {formatVisitRange(v)}
                      {photoCount > 0 && <Camera size={12} className="text-muted" aria-label={`${photoCount} photos`} />}
                      {v.spotify_track_id && <Music2 size={12} className="text-muted" aria-label="Has a soundtrack" />}
                    </p>
                    {v.highlight && <p className="mt-0.5 truncate text-sm text-muted">{v.highlight}</p>}
                  </Link>
                  <ChevronRight size={15} className="shrink-0 text-muted" aria-hidden />
                  <button
                    type="button"
                    aria-label={`Remove the ${v.year} visit`}
                    className="shrink-0 text-muted hover:text-red-700"
                    onClick={() => removeVisit(v.id)}
                  >
                    <X size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <form onSubmit={addVisit} className="mt-3 space-y-6 rounded-lg border border-dashed border-line px-4 py-5">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Plus size={15} className="text-accent" aria-hidden /> Add a trip
          </p>
          <div>
            <p className="eyebrow mb-3">Photos & videos</p>
            <PendingMediaPicker items={pendingMedia} onChange={setPendingMedia} photoCap={PHOTO_CAP[plan]} videoCap={VIDEO_CAP[plan]} />
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
              onPrecisionChange={setPrecision}
              year={year}
              onYearChange={setYear}
              month={month}
              onMonthChange={setMonth}
              visitedFrom={visitedFrom}
              onVisitedFromChange={setVisitedFrom}
              visitedTo={visitedTo}
              onVisitedToChange={setVisitedTo}
            />
          </div>
          <div className="border-t border-line pt-5">
            <label htmlFor="highlight-input" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
              <MessageSquareText size={14} className="text-accent" aria-hidden /> A quick memory
            </label>
            <input
              id="highlight-input"
              type="text"
              placeholder="Optional - add more on its page after"
              className="field !py-1.5 w-full text-sm"
              maxLength={1000}
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-accent w-full justify-center !py-2 text-sm" disabled={addingVisit}>
            <Plus size={15} /> {addingVisit ? uploadStatus ?? "Adding…" : "Add this trip"}
          </button>
        </form>
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
        body="Its trips, cities and photos will be deleted from your archive. This cannot be undone."
        confirmLabel="Remove country"
        busy={removing}
        onConfirm={removeCountry}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}

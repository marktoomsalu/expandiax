"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ImagePlus, Loader2, MapPin, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { COUNTRIES, countryByCode } from "@/lib/countries";
import { cn, formatDate } from "@/lib/utils";

export type AdminPlacement = {
  id: string;
  kind: "event" | "place";
  partner: string;
  country_code: string;
  url: string;
  image_url: string | null;
  name: string | null;
  event_date: string | null;
  venue: string | null;
  city: string | null;
  audience: string[];
  title: string | null;
  body: string | null;
  cta: string | null;
  starts_on: string | null;
  until: string | null;
  active: boolean;
  views: number;
  clicks: number;
  created_at: string;
};

type Draft = {
  kind: "event" | "place";
  partner: string;
  countryCode: string;
  url: string;
  imageUrl: string;
  name: string;
  eventDate: string;
  venue: string;
  city: string;
  everyone: boolean;
  audience: string;
  title: string;
  body: string;
  cta: string;
  startsOn: string;
  until: string;
};

const EMPTY: Draft = {
  kind: "event",
  partner: "",
  countryCode: "",
  url: "",
  imageUrl: "",
  name: "",
  eventDate: "",
  venue: "",
  city: "",
  everyone: false,
  audience: "",
  title: "",
  body: "",
  cta: "",
  startsOn: "",
  until: "",
};

const today = () => new Date().toISOString().slice(0, 10);

/** Running, scheduled, paused or over: what the list says about each one. */
function statusOf(p: AdminPlacement): { label: string; tone: "live" | "soon" | "off" } {
  const t = today();
  if (!p.active) return { label: "Paused", tone: "off" };
  if ((p.until && p.until < t) || (p.kind === "event" && p.event_date && p.event_date < t)) return { label: "Ended", tone: "off" };
  if (p.starts_on && p.starts_on > t) return { label: `Starts ${formatDate(p.starts_on)}`, tone: "soon" };
  return { label: "Running", tone: "live" };
}

const toDraft = (p: AdminPlacement): Draft => ({
  kind: p.kind,
  partner: p.partner,
  countryCode: p.country_code,
  url: p.url,
  imageUrl: p.image_url ?? "",
  name: p.name ?? "",
  eventDate: p.event_date ?? "",
  venue: p.venue ?? "",
  city: p.city ?? "",
  everyone: p.kind === "event" && p.audience.length === 0,
  audience: p.audience.join(", "),
  title: p.title ?? "",
  body: p.body ?? "",
  cta: p.cta ?? "",
  startsOn: p.starts_on ?? "",
  until: p.until ?? "",
});

/** A picture made web-sized before it's sent: at most 1600 px wide, JPEG. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no picture"))), "image/jpeg", 0.85));
}

export function PartnersAdmin({ rows }: { rows: AdminPlacement[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, how: "pause" | "resume" | "remove") {
    if (how === "remove" && !confirm("Remove this placement for good? Its views and clicks go with it.")) return;
    setBusy(id);
    await fetch(`/api/admin/partners/${id}`, {
      method: how === "remove" ? "DELETE" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: how === "remove" ? undefined : JSON.stringify({ onlyActive: true, active: how === "resume" }),
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="mt-8">
      {editing ? (
        <PlacementForm
          id={editing.id}
          initial={editing.draft}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button type="button" onClick={() => setEditing({ id: null, draft: EMPTY })} className="btn-accent">
          <Plus size={16} /> New placement
        </button>
      )}

      <ul className="mt-6 space-y-3">
        {rows.length === 0 && <li className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No placements yet. Add a partner&rsquo;s event or a country card.</li>}
        {rows.map((p) => {
          const status = statusOf(p);
          const country = countryByCode(p.country_code);
          return (
            <li key={p.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-raised text-2xl">{country?.flag}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={cn("rounded-full px-2 py-0.5 font-semibold", status.tone === "live" ? "bg-[#22a06b]/15 text-[#1a7f55]" : status.tone === "soon" ? "bg-accent-soft text-accent" : "bg-raised text-muted")}>{status.label}</span>
                  <span className="text-muted">{p.kind === "event" ? "Event on Explore" : `Card on ${country?.name ?? p.country_code}`}</span>
                  <span className="text-muted">· {p.partner}</span>
                </p>
                <p className="mt-1 truncate font-serif text-lg leading-tight">{p.kind === "event" ? p.name : p.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {p.kind === "event" && p.event_date ? `${formatDate(p.event_date)} · ${[p.venue, p.city].filter(Boolean).join(", ") || country?.name} · ${p.audience.length ? `for people tied to ${p.audience.join(", ")}` : "for everyone"}` : p.body}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-sm">
                <span className="text-right">
                  <span className="block font-semibold">{p.views.toLocaleString("en")}</span>
                  <span className="text-[11px] text-muted">views</span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold">{p.clicks.toLocaleString("en")}</span>
                  <span className="text-[11px] text-muted">{p.views ? `clicks · ${((p.clicks / p.views) * 100).toFixed(1)}%` : "clicks"}</span>
                </span>
                <span className="flex items-center gap-1">
                  <IconButton label="Edit" onClick={() => setEditing({ id: p.id, draft: toDraft(p) })}>
                    <Pencil size={15} />
                  </IconButton>
                  <IconButton label={p.active ? "Pause" : "Resume"} onClick={() => void act(p.id, p.active ? "pause" : "resume")} busy={busy === p.id}>
                    {p.active ? <Pause size={15} /> : <Play size={15} />}
                  </IconButton>
                  <IconButton label="Remove" onClick={() => void act(p.id, "remove")}>
                    <Trash2 size={15} />
                  </IconButton>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IconButton({ label, onClick, busy, children }: { label: string; onClick: () => void; busy?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink">
      {busy ? <Loader2 size={15} className="animate-spin" /> : children}
    </button>
  );
}

function PlacementForm({ id, initial, onDone, onCancel }: { id: string | null; initial: Draft; onDone: () => void; onCancel: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => ({ ...cur, [k]: v }));
  const countries = useMemo(() => [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)), []);
  const country = countryByCode(d.countryCode);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", new File([await shrink(file)], "picture.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/admin/partners/image", { method: "POST", body: form });
      const out = (await res.json()) as { url?: string; error?: string };
      if (out.url) set("imageUrl", out.url);
      else setError(out.error ?? "Couldn't upload it.");
    } catch {
      setError("Couldn't read that picture. Try a JPEG or PNG.");
    }
    setUploading(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const audience = d.everyone ? [] : d.audience.split(/[\s,]+/).filter(Boolean).length ? d.audience.split(/[\s,]+/).filter(Boolean) : d.countryCode ? [d.countryCode] : [];
    const res = await fetch(id ? `/api/admin/partners/${id}` : "/api/admin/partners", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...d, imageUrl: d.imageUrl || null, startsOn: d.startsOn || null, until: d.until || null, audience }),
    });
    const out = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) return setError(out.error ?? "Couldn't save it. Try again.");
    onDone();
  }

  return (
    <div className="rounded-2xl border border-accent/40 bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-xl">{id ? "Edit placement" : "New placement"}</h2>
        <div className="flex rounded-full border border-line p-1 text-sm" role="group" aria-label="What kind">
          {(["event", "place"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={d.kind === k} onClick={() => set("kind", k)} className={cn("rounded-full px-3.5 py-1.5", d.kind === k ? "bg-accent text-white" : "text-muted hover:text-ink")}>
              {k === "event" ? "Event" : "Country card"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Partner" hint="Shown on the label: “Featured · Ahotu”">
              <input className="field" value={d.partner} onChange={(e) => set("partner", e.target.value)} placeholder="Ahotu" maxLength={80} />
            </Field>
            <Field label="Country">
              <select className="field" value={d.countryCode} onChange={(e) => set("countryCode", e.target.value)}>
                <option value="">Choose…</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {d.kind === "event" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Event">
                  <input className="field" value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="BMW Berlin Marathon" maxLength={120} />
                </Field>
                <Field label="Date">
                  <input type="date" className="field" value={d.eventDate} onChange={(e) => set("eventDate", e.target.value)} />
                </Field>
                <Field label="Venue (optional)">
                  <input className="field" value={d.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Brandenburg Gate" maxLength={120} />
                </Field>
                <Field label="City (optional)">
                  <input className="field" value={d.city} onChange={(e) => set("city", e.target.value)} placeholder="Berlin" maxLength={80} />
                </Field>
              </div>
              <Field label="Who sees it" hint="Explore shows it to people whose home or dream list includes these countries.">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" checked={!d.everyone} onChange={() => set("everyone", false)} /> People tied to these countries
                  </label>
                  {!d.everyone && (
                    <input className="field" value={d.audience} onChange={(e) => set("audience", e.target.value.toUpperCase())} placeholder={d.countryCode ? `${d.countryCode} (add more: DE, AT, PL)` : "DE, AT, PL"} />
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" checked={d.everyone} onChange={() => set("everyone", true)} /> Everyone
                  </label>
                </div>
              </Field>
            </>
          ) : (
            <>
              <Field label="Title">
                <input className="field" value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="Portugal in spring" maxLength={120} />
              </Field>
              <Field label="Text" hint={`${d.body.length}/400`}>
                <textarea className="field min-h-24" value={d.body} onChange={(e) => set("body", e.target.value)} maxLength={400} placeholder="Our guide to the coast, the cities and where to eat." />
              </Field>
              <Field label="Button">
                <input className="field" value={d.cta} onChange={(e) => set("cta", e.target.value)} placeholder="Read the guide" maxLength={40} />
              </Field>
            </>
          )}

          <Field label="Link" hint="Where the button goes. Clicks are counted on the way.">
            <input className="field" value={d.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" inputMode="url" />
          </Field>

          <Field label="Picture (optional)">
            <div className="flex items-center gap-3">
              <label className="btn-ghost cursor-pointer !py-2 text-sm">
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} Upload
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
              </label>
              <input className="field flex-1" value={d.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="or paste https://…" />
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts (optional)" hint="Empty: straight away">
              <input type="date" className="field" value={d.startsOn} onChange={(e) => set("startsOn", e.target.value)} />
            </Field>
            <Field label="Ends (optional)" hint={d.kind === "event" ? "Empty: on the event's day" : "Empty: until you pause it"}>
              <input type="date" className="field" value={d.until} onChange={(e) => set("until", e.target.value)} />
            </Field>
          </div>
        </div>

        {/* How members will see it */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Preview</p>
          {d.kind === "event" ? (
            <div className="overflow-hidden rounded-2xl bg-canvas shadow-sm ring-1 ring-line">
              <span className="flex items-stretch">
                <span className="gradient-travel flex w-20 shrink-0 flex-col items-center justify-center text-white">
                  <span className="font-mono text-[10px] tracking-[0.2em]">{d.eventDate ? new Date(`${d.eventDate}T12:00:00`).toLocaleString("en", { month: "short" }).toUpperCase() : "MON"}</span>
                  <span className="font-serif text-3xl leading-none">{d.eventDate ? Number(d.eventDate.slice(8, 10)) : "1"}</span>
                </span>
                <span className="min-w-0 flex-1 border-l-2 border-dashed border-line px-4 py-3">
                  <span className="block font-mono text-[9px] tracking-[0.2em] text-muted">FEATURED · {(d.partner || "PARTNER").toUpperCase()}</span>
                  <span className="mt-0.5 block truncate font-serif text-lg leading-tight">{d.name || "Event name"}</span>
                  <span className="flex items-center gap-1 truncate text-xs text-muted">
                    <MapPin size={11} /> {[d.venue, d.city].filter(Boolean).join(", ") || country?.name || "Where"}
                  </span>
                </span>
              </span>
            </div>
          ) : (
            <aside className="overflow-hidden rounded-2xl border border-accent/30 bg-canvas">
              {d.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.imageUrl} alt="" className="aspect-[16/7] w-full object-cover" />
              )}
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Partner · {d.partner || "Partner"}</p>
                <p className="mt-1 font-serif text-lg">{d.title || "Title"}</p>
                <p className="mt-1 text-sm text-muted">{d.body || "The card's text."}</p>
                <span className="btn-accent mt-3 inline-flex !py-1.5 text-sm">{d.cta || "Button"}</span>
              </div>
            </aside>
          )}
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
            <CalendarDays size={13} className="mt-0.5 shrink-0" />
            {d.kind === "event"
              ? `On Explore, “On your radar”, for ${d.everyone ? "everyone" : `people who live in or dream of ${d.audience || d.countryCode || "its countries"}`}.`
              : `On ${country?.name ?? "the country"}'s page in Explore.`}
          </p>
        </div>
      </div>

      {error && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-400">{error}</p>}
      <div className="mt-5 flex items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={saving || uploading} className="btn-accent">
          {saving ? <Loader2 size={15} className="animate-spin" /> : null} {id ? "Save changes" : "Add placement"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-muted hover:text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

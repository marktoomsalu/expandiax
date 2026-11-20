import type { createAdminClient } from "@/lib/supabase/admin";
import { duration, FEATURE_LABELS, PAGE_LABELS } from "@/lib/usage";

type Admin = ReturnType<typeof createAdminClient>;
type Row = { day: string; kind: "page" | "feature" | "visit"; key: string; count: number };

const DAYS = 30;

/** Rows made in the last 30 days in a table: what members did, counted without anyone named. */
async function made(admin: Admin, table: string, column = "created_at", since: string): Promise<number> {
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true }).gte(column, since);
  return error ? 0 : count ?? 0;
}

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-serif text-3xl tabular-nums">{typeof value === "number" ? value.toLocaleString("en-GB") : value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

/** A ranked list with a bar each: the biggest is full width, the rest in proportion. */
function Ranked({ title, rows, note }: { title: string; rows: { label: string; n: number }[]; note?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  const total = rows.reduce((a, r) => a + r.n, 0);
  return (
    <figure className="rounded-2xl border border-line bg-surface px-4 py-4">
      <figcaption className="font-serif text-lg">{title}</figcaption>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing counted yet.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{r.label}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  {r.n.toLocaleString("en-GB")}
                  {total ? <span className="ml-1.5 text-[11px]">{Math.round((r.n / total) * 100)}%</span> : null}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-raised">
                <div className="h-full rounded-full bg-[#FA51A2] dark:bg-[#E8478F]" style={{ width: `${Math.max(2, (r.n / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
      {note && <p className="mt-3 text-[11px] text-muted">{note}</p>}
    </figure>
  );
}

/**
 * How the app is used, the last 30 days: visits and their length, the pages
 * opened most and the features used. All anonymous totals (migration 086
 * for pages, visits and taps; the tables themselves for what was made).
 */
export async function UsageSection({ admin, today }: { admin: Admin; today: string }) {
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - (DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
  const [{ data, error }, countries, events, photos, eventPhotos, messages, follows, likes, comments, people, dreams, journals] = await Promise.all([
    admin.from("usage_totals").select("day, kind, key, count").gte("day", since),
    made(admin, "visited_countries", "created_at", since),
    made(admin, "events", "created_at", since),
    made(admin, "country_media", "created_at", since),
    made(admin, "event_media", "created_at", since),
    made(admin, "messages", "created_at", since),
    made(admin, "follows", "created_at", since),
    made(admin, "likes", "created_at", since),
    made(admin, "comments", "created_at", since),
    made(admin, "post_collaborators", "created_at", since),
    made(admin, "want_to_go", "created_at", since),
    made(admin, "trip_journals", "updated_at", since),
  ]);
  const rows = (error ? [] : data ?? []) as Row[];
  const sum = (kind: Row["kind"], key?: string) => rows.filter((r) => r.kind === kind && (!key || r.key === key)).reduce((a, r) => a + Number(r.count), 0);
  const visits = sum("visit", "visits");
  const seconds = sum("visit", "seconds");
  const pageViews = sum("page");
  const firstDay = rows.map((r) => r.day).sort()[0];

  const byKey = (kind: Row["kind"]) => {
    const m = new Map<string, number>();
    for (const r of rows.filter((x) => x.kind === kind)) m.set(r.key, (m.get(r.key) ?? 0) + Number(r.count));
    return m;
  };
  const pages = [...byKey("page")].map(([k, n]) => ({ label: PAGE_LABELS[k] ?? k, n })).sort((a, b) => b.n - a.n).slice(0, 12);
  const taps = byKey("feature");
  const features = [
    { label: "Photos and videos added", n: photos + eventPhotos },
    { label: "Countries added", n: countries },
    { label: "Events logged", n: events },
    { label: "Messages sent", n: messages },
    { label: "Follows", n: follows },
    { label: "Likes", n: likes },
    { label: "Comments", n: comments },
    { label: "People added to memories", n: people },
    { label: "Dream places added", n: dreams },
    { label: "Journals written", n: journals },
    ...[...taps].map(([k, n]) => ({ label: FEATURE_LABELS[k] ?? k, n })),
  ]
    .filter((f) => f.n > 0)
    .sort((a, b) => b.n - a.n);

  return (
    <section aria-labelledby="usage-h" className="mt-8">
      <h2 id="usage-h" className="font-serif text-xl">How the app is used</h2>
      <p className="mt-0.5 text-xs text-muted">
        The last 30 days, as anonymous totals: no one is named or counted individually.
        {firstDay && firstDay > since ? ` Pages and visit times are counted since ${new Date(`${firstDay}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.` : ""}
        {error ? " Pages and visit times start once migration 086 is run." : ""}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Visits" value={visits} sub="a new one after 5 min away" />
        <Tile label="Average visit" value={visits ? duration(seconds / visits) : "–"} sub="time actually using the app" />
        <Tile label="Time in the app" value={duration(seconds)} sub="all members together" />
        <Tile label="Pages opened" value={pageViews} sub={visits ? `${(pageViews / visits).toFixed(1)} per visit` : undefined} />
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <Ranked title="Most-opened pages" rows={pages} />
        <Ranked title="Features used" rows={features} note="Made in the last 30 days, plus invites and chat taps." />
      </div>
    </section>
  );
}

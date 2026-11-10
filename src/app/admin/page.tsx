import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { countryByCode } from "@/lib/countries";
import { SPONSORS } from "@/lib/sponsors";
import { activeCounts, activePerDay, addDays, cameBack, pct, perDay, type ActiveDay, type Member } from "@/lib/adminStats";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Admin = ReturnType<typeof createAdminClient>;

/** Every row of a small selection, a page at a time (PostgREST returns 1,000 at most per request). */
async function all<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await query(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/** How many rows a table has. */
async function count(admin: Admin, table: string): Promise<number> {
  const { count: n } = await admin.from(table).select("*", { count: "exact", head: true });
  return n ?? 0;
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

const shortDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** One series of daily counts as thin bars, a tooltip on each day, and the same numbers as a table for screen readers. */
function Bars({ title, data, note }: { title: string; data: { day: string; n: number }[]; note?: string }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const total = data.reduce((a, d) => a + d.n, 0);
  return (
    <figure className="rounded-2xl border border-line bg-surface px-4 py-4">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-serif text-lg">{title}</span>
        <span className="text-xs text-muted">{total.toLocaleString("en-GB")} in 30 days</span>
      </figcaption>
      <div className="relative mt-4">
        <span className="absolute -top-3 left-0 text-[10px] tabular-nums text-muted">{max}</span>
        <div className="flex h-32 items-end gap-[2px] border-b border-line pt-2" aria-hidden>
          {data.map((d) => (
            <div key={d.day} className="group relative flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t-[4px] bg-[#FA51A2] dark:bg-[#E8478F]"
                style={{ height: d.n ? `${Math.max(3, (d.n / max) * 100)}%` : 0 }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] text-canvas group-hover:block">
                {shortDay(d.day)} · {d.n}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted" aria-hidden>
          <span>{shortDay(data[0].day)}</span>
          <span>{shortDay(data[data.length - 1].day)}</span>
        </div>
      </div>
      {note && <p className="mt-2 text-[11px] text-muted">{note}</p>}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              <td>{d.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/**
 * The founder's dashboard: members, who's active, who comes back, what
 * they add, and the business side. Counts and shares only — no one is
 * named — and only people on the admins list can open it.
 */
export default async function AdminPage() {
  const user = await getAuthUser();
  if (!user) notFound();
  const admin = createAdminClient();
  const { data: isAdmin } = await admin.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!isAdmin) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const [profiles, activity, countryOwners, eventOwners, followers, tokens, audience, totals] = await Promise.all([
    all<{ id: string; created_at: string }>((a, b) => admin.from("profiles").select("id, created_at").order("created_at").range(a, b)),
    all<ActiveDay>((a, b) => admin.from("activity_days").select("user_id, day").gte("day", addDays(today, -400)).order("day").range(a, b)),
    all<{ user_id: string }>((a, b) => admin.from("visited_countries").select("user_id").range(a, b)),
    all<{ user_id: string }>((a, b) => admin.from("events").select("user_id").range(a, b)),
    all<{ follower_id: string }>((a, b) => admin.from("follows").select("follower_id").range(a, b)),
    all<{ platform: string }>((a, b) => admin.from("device_tokens").select("platform").range(a, b)),
    admin.rpc("explore_audience").then((r) => r.data as { dreamers: number; top_dreams: { country_code: string; dreamers: number }[] } | null),
    Promise.all(
      ["country_media", "event_media", "want_to_go", "place_questions", "place_answers", "likes", "comments"].map((t) => count(admin, t))
    ),
  ]);
  const [media1, media2, dreams, questions, answers, likes, comments] = totals;

  const members: Member[] = profiles.map((p) => ({ id: p.id, joined: p.created_at.slice(0, 10) }));
  const trackingSince = activity[0]?.day ?? null;
  const active = activeCounts(activity, today);
  const joinedThisWeek = members.filter((m) => m.joined >= addDays(today, -6)).length;
  const back = [1, 7, 30].map((n) => ({ n, ...cameBack(members, activity, n, today, trackingSince) }));
  const withCountry = new Set(countryOwners.map((r) => r.user_id)).size;
  const withEvent = new Set(eventOwners.map((r) => r.user_id)).size;
  const withFollow = new Set(followers.map((r) => r.follower_id)).size;
  const ios = tokens.filter((t) => t.platform === "ios").length;
  const android = tokens.filter((t) => t.platform === "android").length;
  const sponsorsLive = SPONSORS.filter((s) => !s.until || s.until >= today).length;

  // Reports, newest first: the one place people are named, because acting on a report needs it.
  const { data: reportRows } = await admin.from("reports").select("id, reporter_id, target_type, target_id, target_url, reason, created_at").order("created_at", { ascending: false }).limit(40);
  const reports = reportRows ?? [];
  const messageIds = reports.filter((r) => r.target_type === "message").map((r) => r.target_id);
  const { data: reportedMessages } = messageIds.length
    ? await admin.from("messages").select("id, sender_id, body").in("id", messageIds)
    : { data: [] as { id: string; sender_id: string; body: string }[] };
  const messageById = new Map((reportedMessages ?? []).map((m) => [m.id, m]));
  const peopleIds = [...new Set([...reports.map((r) => r.reporter_id), ...(reportedMessages ?? []).map((m) => m.sender_id)])];
  const { data: named } = peopleIds.length
    ? await admin.from("profiles").select("id, username").in("id", peopleIds)
    : { data: [] as { id: string; username: string }[] };
  const usernameOf = new Map((named ?? []).map((p) => [p.id, p.username]));

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Lock size={12} aria-hidden /> Only you can see this · counts only, nobody is named
      </p>
      <h1 className="mt-2 text-3xl md:text-4xl">Dashboard</h1>

      <section aria-label="Members" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Members" value={members.length} sub={`+${joinedThisWeek} this week`} />
        <Tile label="Active today" value={active.day} />
        <Tile label="Active this week" value={active.week} />
        <Tile label="Active this month" value={active.month} sub={`${pct(active.day, active.month)} come daily`} />
      </section>

      <section aria-label="Daily" className="mt-6 grid gap-4 md:grid-cols-2">
        <Bars title="New members" data={perDay(members.map((m) => m.joined), 30, today)} />
        <Bars
          title="Active members"
          data={activePerDay(activity, 30, today)}
          note={trackingSince ? `Counted since ${shortDay(trackingSince)}.` : "Starts filling in once members use ExpandiaX after this update."}
        />
      </section>

      <section aria-labelledby="back-h" className="mt-8">
        <h2 id="back-h" className="font-serif text-xl">Do they come back?</h2>
        <p className="mt-0.5 text-xs text-muted">Of members who joined after active days began being counted - the number investors ask about first.</p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {back.map((b) => (
            <Tile key={b.n} label={`After ${b.n} ${b.n === 1 ? "day" : "days"}`} value={pct(b.returned, b.eligible)} sub={b.eligible ? `${b.returned} of ${b.eligible}` : "not enough data yet"} />
          ))}
        </div>
      </section>

      <section aria-labelledby="act-h" className="mt-8">
        <h2 id="act-h" className="font-serif text-xl">What members do</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Added a country" value={pct(withCountry, members.length)} sub={`${withCountry} members`} />
          <Tile label="Logged an event" value={pct(withEvent, members.length)} sub={`${withEvent} members`} />
          <Tile label="Follow someone" value={pct(withFollow, members.length)} sub={`${withFollow} members`} />
          <Tile label="Countries per member" value={members.length ? (countryOwners.length / members.length).toFixed(1) : "–"} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Countries pinned" value={countryOwners.length} />
          <Tile label="Events logged" value={eventOwners.length} />
          <Tile label="Photos & videos" value={media1 + media2} />
          <Tile label="Follows" value={followers.length} />
          <Tile label="Likes" value={likes} />
          <Tile label="Comments" value={comments} />
          <Tile label="Questions · answers" value={`${questions} · ${answers}`} />
          <Tile label="Dream places" value={dreams} sub={audience ? `${audience.dreamers} dreamers` : undefined} />
        </div>
      </section>

      <section aria-labelledby="biz-h" className="mt-8">
        <h2 id="biz-h" className="font-serif text-xl">Apps &amp; business</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="iPhones with notifications" value={ios} />
          <Tile label="Androids with notifications" value={android} />
          <Tile label="Partner placements live" value={sponsorsLive} />
          <Tile label="Revenue" value="€0" sub="add once sales start" />
        </div>
        {audience && audience.top_dreams.length > 0 && (
          <p className="mt-3 text-sm text-muted">
            Most dreamed-of:{" "}
            {audience.top_dreams
              .slice(0, 6)
              .map((d) => `${countryByCode(d.country_code.slice(0, 2))?.flag ?? ""} ${d.dreamers}`)
              .join("  ·  ")}
          </p>
        )}
      </section>

      <section aria-labelledby="reports-h" className="mt-8">
        <h2 id="reports-h" className="font-serif text-xl">Reports</h2>
        <p className="mt-1 text-xs text-muted">
          Newest first. Three people reporting someone&rsquo;s messages pauses their chat automatically; two, or three postcards turned down in a
          month, pauses their postcards. Blocking them for good: their profile &rsaquo; Block.
        </p>
        {reports.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No reports.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {reports.map((r) => {
              const m = r.target_type === "message" ? messageById.get(r.target_id) : null;
              return (
                <li key={r.id} className="px-4 py-3 text-sm">
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    <span className="rounded-full bg-raised px-2 py-0.5 font-medium text-ink">{r.target_type}</span>
                    {r.created_at.slice(0, 16).replace("T", " ")}
                    <span>· by @{usernameOf.get(r.reporter_id) ?? "?"}</span>
                    {m && <span>· sender @{usernameOf.get(m.sender_id) ?? "?"}</span>}
                  </p>
                  <p className="mt-1">{r.reason}</p>
                  {m && <p className="mt-1 rounded-lg bg-raised px-3 py-2 text-xs">&ldquo;{m.body}&rdquo;</p>}
                  <a href={r.target_url} className="mt-1 inline-block text-xs text-accent hover:underline">Open</a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

import { countryByCode } from "@/lib/countries";
import { pct, type Market } from "@/lib/adminStats";

// Where members come from, for the founder's dashboard: the home country
// each member chose when they joined (onboarding asks; Settings changes it).
// Nothing is worked out from anyone's connection, and only counts are shown.

const nameOf = (code: string) => countryByCode(code)?.name ?? code;
const flagOf = (code: string) => countryByCode(code)?.flag ?? "🏳️";

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 truncate font-serif text-3xl tabular-nums">{typeof value === "number" ? value.toLocaleString("en-GB") : value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

/** A ranked list: flag and country, a bar for its share, the number. */
function Ranked({ title, note, rows, total, value, extra }: { title: string; note: string; rows: Market[]; total: number; value: (m: Market) => number; extra?: (m: Market) => React.ReactNode }) {
  const max = Math.max(1, ...rows.map(value));
  return (
    <figure className="rounded-2xl border border-line bg-surface px-4 py-4">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-serif text-lg">{title}</span>
        <span className="text-xs text-muted">{note}</span>
      </figcaption>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No one yet.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {rows.map((m) => (
            <li key={m.code} className="grid grid-cols-[1.4rem_minmax(0,7.5rem)_1fr_auto] items-center gap-2 text-sm">
              <span aria-hidden>{flagOf(m.code)}</span>
              <span className="truncate">{nameOf(m.code)}</span>
              <span className="h-2 overflow-hidden rounded-full bg-raised" aria-hidden>
                <span className="block h-full rounded-full bg-[#FA51A2] dark:bg-[#E8478F]" style={{ width: `${(value(m) / max) * 100}%` }} />
              </span>
              <span className="flex items-baseline gap-1.5 text-right tabular-nums">
                <span className="w-9">{value(m)}</span>
                <span className="w-9 text-[11px] text-muted">{pct(value(m), total)}</span>
                {extra?.(m)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}

/** Up on the month before, the same, or a first member there. */
function Trend({ m }: { m: Market }) {
  if (m.recent === m.members) return <span className="w-10 rounded-full bg-accent-soft px-1.5 text-center text-[10px] font-semibold text-accent">new</span>;
  if (m.recent > m.before) return <span className="w-10 text-[11px] text-emerald-600 dark:text-emerald-400">▲ {m.before}</span>;
  if (m.recent < m.before) return <span className="w-10 text-[11px] text-muted">▼ {m.before}</span>;
  return <span className="w-10 text-[11px] text-muted">= {m.before}</span>;
}

export function MembersByCountry({ markets, unknown, recentTotal, members }: { markets: Market[]; unknown: number; recentTotal: number; members: number }) {
  const known = members - unknown;
  const top = markets[0];
  const abroad = top ? known - top.members : 0;
  const recentKnown = markets.reduce((a, m) => a + m.recent, 0);
  const recentAbroad = top ? recentKnown - top.recent : 0;
  const growing = [...markets].filter((m) => m.recent > 0).sort((a, b) => b.recent - a.recent || b.members - a.members);
  const firsts = markets.filter((m) => m.recent === m.members);

  return (
    <section aria-labelledby="where-h" className="mt-8">
      <h2 id="where-h" className="font-serif text-xl">Where members come from</h2>
      <p className="mt-0.5 text-xs text-muted">The home country members choose when they join. Counts only, never worked out from their connection.</p>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Countries" value={markets.length} sub={firsts.length ? `${firsts.length} new in 30 days` : "no new ones in 30 days"} />
        <Tile label="Top market" value={top ? `${flagOf(top.code)} ${pct(top.members, known)}` : "–"} sub={top ? `${nameOf(top.code)} · ${top.members} members` : undefined} />
        <Tile label={top ? `Outside ${nameOf(top.code)}` : "International"} value={pct(abroad, known)} sub={`${abroad} members`} />
        <Tile label="New, outside top market" value={pct(recentAbroad, recentKnown)} sub={`${recentAbroad} of ${recentKnown} in 30 days`} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Ranked title="All members" note={`${known.toLocaleString("en-GB")} with a home`} rows={markets.slice(0, 10)} total={known} value={(m) => m.members} />
        <Ranked
          title="Joined in 30 days"
          note={`▲▼ vs the 30 before`}
          rows={growing.slice(0, 10)}
          total={recentKnown}
          value={(m) => m.recent}
          extra={(m) => <Trend m={m} />}
        />
      </div>

      {firsts.length > 0 && (
        <p className="mt-3 text-sm">
          <span className="text-muted">First members in the last 30 days: </span>
          {firsts.map((m) => `${flagOf(m.code)} ${nameOf(m.code)}`).join("  ·  ")}
        </p>
      )}

      {markets.length > 10 && (
        <details className="mt-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">All {markets.length} countries</summary>
          <table className="mt-3 w-full text-left tabular-nums">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 font-normal">Country</th>
                <th className="py-1 text-right font-normal">Members</th>
                <th className="py-1 text-right font-normal">Share</th>
                <th className="py-1 text-right font-normal">30 days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {markets.map((m) => (
                <tr key={m.code}>
                  <td className="py-1.5">{flagOf(m.code)} {nameOf(m.code)}</td>
                  <td className="py-1.5 text-right">{m.members}</td>
                  <td className="py-1.5 text-right text-muted">{pct(m.members, known)}</td>
                  <td className="py-1.5 text-right">{m.recent ? `+${m.recent}` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <p className="mt-2 text-[11px] text-muted">
        {unknown > 0 ? `${unknown} ${unknown === 1 ? "member hasn't" : "members haven't"} picked a home yet. ` : ""}
        {recentTotal} joined in the last 30 days.
      </p>
    </section>
  );
}

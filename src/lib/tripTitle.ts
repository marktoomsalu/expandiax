// A trip's date as a big headline plus a small line for the days:
// "September 2026" with "7–8 September", instead of one long
// "7 September 2026 – 8 September 2026".

type Visit = { year: number; visited_from: string | null; visited_to: string | null; date_precision?: "year" | "month" | "day" | null };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = MONTHS.map((m) => m.slice(0, 3));

const parts = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
};

export function tripTitle(v: Visit): { headline: string; days: string | null } {
  const precision = v.date_precision ?? (v.visited_from ? "day" : "year");
  if (precision === "year" || !v.visited_from) return { headline: String(v.year), days: null };
  const a = parts(v.visited_from);
  if (precision === "month") return { headline: `${MONTHS[a.m]} ${a.y}`, days: null };

  const b = parts(v.visited_to ?? v.visited_from);
  if (a.y === b.y && a.m === b.m) {
    return { headline: `${MONTHS[a.m]} ${a.y}`, days: a.d === b.d ? `${a.d} ${MONTHS[a.m]}` : `${a.d}–${b.d} ${MONTHS[a.m]}` };
  }
  if (a.y === b.y) {
    return { headline: `${SHORT[a.m]} – ${SHORT[b.m]} ${a.y}`, days: `${a.d} ${SHORT[a.m]} – ${b.d} ${SHORT[b.m]}` };
  }
  return { headline: `${SHORT[a.m]} ${a.y} – ${SHORT[b.m]} ${b.y}`, days: `${a.d} ${SHORT[a.m]} – ${b.d} ${SHORT[b.m]}` };
}

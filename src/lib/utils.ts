export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatDate(iso: string) {
  return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type VisitLike = {
  year: number;
  visited_from: string | null;
  visited_to: string | null;
  date_precision?: "year" | "month" | "day" | null;
};

export function formatVisitRange(v: VisitLike) {
  const precision = v.date_precision ?? (v.visited_from ? "day" : "year");
  if (precision === "year" || !v.visited_from) return String(v.year);
  if (precision === "month") return formatMonthYear(v.visited_from);
  if (!v.visited_to || v.visited_to === v.visited_from) return formatDate(v.visited_from);
  return `${formatDate(v.visited_from)} – ${formatDate(v.visited_to)}`;
}

export function visitSortKey(v: { year: number; visited_from: string | null; visited_to: string | null }) {
  return v.visited_to ?? v.visited_from ?? `${v.year}-12-31`;
}

export function formatMonthYear(iso: string) {
  return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function formatRelative(iso: string) {
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.round(day / 7);
  if (week < 5) return `${week}w ago`;
  const month = Math.round(day / 30);
  if (month < 12) return `${month}mo ago`;
  return `${Math.round(day / 365)}y ago`;
}

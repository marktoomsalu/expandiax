// The "When" chips on What's on: today, tomorrow, this weekend, the next
// seven days, and the next few months by name. Dates are whole days,
// "YYYY-MM-DD", inclusive.

export type When = { key: string; label: string; from: string; until: string };

const day = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));

export function whenOptions(now: Date, months = 4): When[] {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = today.getUTCDay(); // 0 Sunday … 6 Saturday
  const saturday = dow === 0 ? addDays(today, -1) : addDays(today, (6 - dow + 7) % 7);
  const weekendFrom = dow === 0 || dow === 6 ? today : saturday;
  const out: When[] = [
    { key: "today", label: "Today", from: day(today), until: day(today) },
    { key: "tomorrow", label: "Tomorrow", from: day(addDays(today, 1)), until: day(addDays(today, 1)) },
    { key: "weekend", label: "This weekend", from: day(weekendFrom), until: day(addDays(saturday, 1)) },
    { key: "week", label: "Next 7 days", from: day(today), until: day(addDays(today, 6)) },
  ];
  for (let i = 0; i < months; i++) {
    const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    const name = first.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
    out.push({
      key: day(first).slice(0, 7),
      label: first.getUTCFullYear() === today.getUTCFullYear() ? name : `${name} ${first.getUTCFullYear()}`,
      // This month starts today.
      from: i === 0 ? day(today) : day(first),
      until: day(last),
    });
  }
  return out;
}

// Which dream countries the Departures board shows: at most five. Those
// where someone has just been (a trip added or changed in the last two
// weeks) come first, the most recent at the top, so a dream nobody had
// been to jumps up the moment someone goes. The rest take turns, a new set
// each day, so the board stays fresh. Pure, for tests.

export const DEPARTURES_SHOWN = 5;
const FRESH_DAYS = 14;

export function pickDepartures<T extends { code: string }>(dreams: T[], lastActivity: Map<string, string>, now: Date, limit = DEPARTURES_SHOWN): T[] {
  const freshSince = now.getTime() - FRESH_DAYS * 86_400_000;
  const fresh = dreams
    .filter((d) => Date.parse(lastActivity.get(d.code) ?? "") >= freshSince)
    .sort((a, b) => (lastActivity.get(b.code) ?? "").localeCompare(lastActivity.get(a.code) ?? ""));
  const rest = dreams.filter((d) => !fresh.includes(d));
  // A different starting point each day.
  const day = Math.floor(now.getTime() / 86_400_000);
  const start = rest.length ? day % rest.length : 0;
  const turned = [...rest.slice(start), ...rest.slice(0, start)];
  return [...fresh, ...turned].slice(0, limit);
}

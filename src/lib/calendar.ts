// Month grids for the in-app date picker. Dates are plain "yyyy-mm-dd"
// strings throughout, worked out in UTC so no time zone can shift a day.

export type YearMonth = { y: number; m: number }; // m: 1-12

const pad = (n: number) => String(n).padStart(2, "0");

export const isoDay = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
export const ymOf = (iso: string): YearMonth => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) });
const ymKey = ({ y, m }: YearMonth) => `${y}-${pad(m)}`;

/** The month `delta` months away. */
export function shiftMonth({ y, m }: YearMonth, delta: number): YearMonth {
  const i = y * 12 + (m - 1) + delta;
  return { y: Math.floor(i / 12), m: (i % 12) + 1 };
}

/** The month's days in weeks that start on Monday; null pads the first and last week. */
export function monthGrid({ y, m }: YearMonth): (string | null)[][] {
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => isoDay(y, m, i + 1))];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** Which month the picker opens on: the chosen date, else `openTo` (e.g. the start date), else today — kept within min/max. */
export function startMonth(value: string, openTo: string | undefined, min: string | undefined, max: string | undefined, today: string): YearMonth {
  let ym = ymOf(value || openTo || today);
  if (min && ymKey(ym) < min.slice(0, 7)) ym = ymOf(min);
  if (max && ymKey(ym) > max.slice(0, 7)) ym = ymOf(max);
  return ym;
}

/** Whether there is a month before / after this one that still has days in range. */
export function canShift(ym: YearMonth, delta: -1 | 1, min?: string, max?: string): boolean {
  const next = ymKey(shiftMonth(ym, delta));
  if (delta < 0) return !min || next >= min.slice(0, 7);
  return !max || next <= max.slice(0, 7);
}

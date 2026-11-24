// The App Store's current iPhone version decides when 1.1's features are
// announced: "What's new" (in the new app) and "Update available" (in the
// old one) stay hidden until the App Store itself has 1.1, never during
// review or TestFlight.

export const FEATURES_VERSION = "1.1";
/** When 1.1 came out on the App Store. */
export const FEATURES_RELEASED_AT = "2026-11-14T16:15:20Z";

/**
 * "What's new" is for people who were here before 1.1 (they updated, or
 * already had an account): someone who joins after it has nothing "new",
 * it's simply how the app is.
 */
export function joinedBeforeFeatures(joinedAt: string | null | undefined): boolean {
  return !!joinedAt && Date.parse(joinedAt) < Date.parse(FEATURES_RELEASED_AT);
}

/** -1, 0 or 1, for versions like "1.0", "1.1", "1.10.2". */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

type StoreInfo = { ios: string | null; iosReleasedAt: string | null };
let pending: Promise<StoreInfo> | null = null;

/** The App Store's version and when it came out (fetched once per app session). */
export function storeInfo(): Promise<StoreInfo> {
  pending ??= fetch("/api/app-version")
    .then((r) => (r.ok ? r.json() : null))
    .then((d: Partial<StoreInfo> | null) => ({ ios: d?.ios ?? null, iosReleasedAt: d?.iosReleasedAt ?? null }))
    .catch(() => ({ ios: null, iosReleasedAt: null }));
  return pending;
}

/** The App Store's version (fetched once per app session), or null if unknown. */
export const storeVersion = (): Promise<string | null> => storeInfo().then((i) => i.ios);

/** 1.2: Discover my world, the automatic memory finder. */
export const FIND_VERSION = "1.2";

/**
 * Whether 1.2 is out on the App Store, and whether this member was here
 * before it (they updated): someone who joined after has found their world
 * while signing up, so there's nothing "new" to tell them.
 */
export async function findReleasedFor(joinedAt: string | null | undefined): Promise<boolean> {
  const { ios, iosReleasedAt } = await storeInfo();
  if (!ios || compareVersions(ios, FIND_VERSION) < 0) return false;
  return !!joinedAt && (!iosReleasedAt || Date.parse(joinedAt) < Date.parse(iosReleasedAt));
}

/** Whether 1.1 (and its features) is out on the App Store. */
export async function featuresReleased(): Promise<boolean> {
  const v = await storeVersion();
  return !!v && compareVersions(v, FEATURES_VERSION) >= 0;
}

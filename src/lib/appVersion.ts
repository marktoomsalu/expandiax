// The App Store's current iPhone version decides when 1.1's features are
// announced: "What's new" (in the new app) and "Update available" (in the
// old one) stay hidden until the App Store itself has 1.1, never during
// review or TestFlight.

export const FEATURES_VERSION = "1.1";

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

let pending: Promise<string | null> | null = null;

/** The App Store's version (fetched once per app session), or null if unknown. */
export function storeVersion(): Promise<string | null> {
  pending ??= fetch("/api/app-version")
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { ios?: string | null } | null) => d?.ios ?? null)
    .catch(() => null);
  return pending;
}

/** Whether 1.1 (and its features) is out on the App Store. */
export async function featuresReleased(): Promise<boolean> {
  const v = await storeVersion();
  return !!v && compareVersions(v, FEATURES_VERSION) >= 0;
}

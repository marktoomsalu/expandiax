import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// Memory photos and videos live in a private bucket. The database keeps each
// file's permanent address (…/object/public/media/<path>) as its identifier;
// before anything reaches the browser, those addresses are swapped for
// short-lived signed links. Only data the viewer's own session was allowed
// to read is ever passed through here, so the database's visibility rules
// decide what gets signed.

const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;
// Every server hands out the SAME link for a photo within one 12-hour window
// (shared through Next's data cache, not just this server's memory). The
// image optimiser and phones cache a photo by its link, so a link that kept
// changing meant photos were made again and downloaded again, over and over
// (0.7–1.7 s each, instead of 0.2 s). A link lasts 18 hours: the window,
// plus room for a page opened at its very end.
const WINDOW = 12 * 60 * 60 * 1000;
const LIFETIME = 18 * 60 * 60; // seconds a link is valid

const cache = new Map<string, { url: string; until: number }>();

export function mediaPath(url: string): string | null {
  if (!url.startsWith(BASE)) return null;
  const rest = url.slice(BASE.length).split("?")[0];
  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
}

function collect(value: unknown, into: Set<string>, seen: Set<object>) {
  if (typeof value === "string") {
    const path = mediaPath(value);
    if (path) into.add(path);
  } else if (value && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const v of Array.isArray(value) ? value : Object.values(value)) collect(v, into, seen);
  }
}

function replace<T>(value: T, signed: Map<string, string>): T {
  if (typeof value === "string") {
    const path = mediaPath(value);
    return (path ? signed.get(path) ?? value : value) as T;
  }
  if (Array.isArray(value)) return value.map((v) => replace(v, signed)) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replace(v, signed)])) as T;
  }
  return value;
}

/**
 * Signed links for these storage paths (cached and reused for a few hours).
 * `lifetimeDays` is for link previews of public pages, which apps fetch later.
 */
export async function signPaths(paths: string[], lifetimeDays?: number): Promise<Map<string, string>> {
  if (lifetimeDays) {
    const { data } = await createAdminClient().storage.from("media").createSignedUrls([...new Set(paths)], lifetimeDays * 86_400);
    const out = new Map<string, string>();
    for (const d of data ?? []) if (d.path && d.signedUrl && !d.error) out.set(d.path, d.signedUrl);
    return out;
  }
  const now = Date.now();
  const windowNo = Math.floor(now / WINDOW);
  const windowEnd = (windowNo + 1) * WINDOW;
  const out = new Map<string, string>();
  const missing: string[] = [];
  for (const p of new Set(paths)) {
    const hit = cache.get(p);
    if (hit && hit.until > now) out.set(p, hit.url);
    else missing.push(p);
  }
  // Not on this server yet: the link every server agreed on for this window,
  // made once (the first to ask signs it, the rest reuse it).
  await Promise.all(
    missing.map(async (p) => {
      const url = await sharedLink(p, windowNo).catch(() => null);
      if (!url) return;
      out.set(p, url);
      cache.set(p, { url, until: windowEnd });
    })
  );
  if (cache.size > 20_000) for (const [k, v] of cache) if (v.until <= now) cache.delete(k);
  return out;
}

/** One photo's link for one window, the same on every server (Next's data cache). */
function sharedLink(path: string, windowNo: number): Promise<string | null> {
  return unstable_cache(
    async () => {
      const { data, error } = await createAdminClient().storage.from("media").createSignedUrl(path, LIFETIME);
      if (error || !data?.signedUrl) throw new Error("sign failed"); // never cached
      return data.signedUrl;
    },
    ["media-link", path, String(windowNo)],
    { revalidate: LIFETIME - 60 }
  )();
}

/**
 * Returns a copy of `data` (rows, lists, nested objects) with every memory
 * photo/video address replaced by a signed link. Everything else is untouched.
 */
export async function signMedia<T>(data: T, opts?: { lifetimeDays?: number }): Promise<T> {
  const paths = new Set<string>();
  collect(data, paths, new Set());
  if (paths.size === 0) return data;
  return replace(data, await signPaths([...paths], opts?.lifetimeDays));
}

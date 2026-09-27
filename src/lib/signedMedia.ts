import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Memory photos and videos live in a private bucket. The database keeps each
// file's permanent address (…/object/public/media/<path>) as its identifier;
// before anything reaches the browser, those addresses are swapped for
// short-lived signed links. Only data the viewer's own session was allowed
// to read is ever passed through here, so the database's visibility rules
// decide what gets signed.

const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;
const LIFETIME = 6 * 60 * 60; // seconds a link is valid
const REUSE_FOR = 4 * 60 * 60 * 1000; // hand out the same link for this long — keeps image caching effective

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
  const out = new Map<string, string>();
  const missing: string[] = [];
  for (const p of new Set(paths)) {
    const hit = cache.get(p);
    if (hit && hit.until > now) out.set(p, hit.url);
    else missing.push(p);
  }
  for (let i = 0; i < missing.length; i += 100) {
    const batch = missing.slice(i, i + 100);
    const { data } = await createAdminClient().storage.from("media").createSignedUrls(batch, LIFETIME);
    for (const d of data ?? []) {
      if (!d.path || !d.signedUrl || d.error) continue;
      out.set(d.path, d.signedUrl);
      cache.set(d.path, { url: d.signedUrl, until: now + REUSE_FOR });
    }
  }
  if (cache.size > 20_000) for (const [k, v] of cache) if (v.until <= now) cache.delete(k);
  return out;
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

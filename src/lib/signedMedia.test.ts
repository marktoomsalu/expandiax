import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const createSignedUrls = vi.fn();
const createSignedUrl = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ storage: { from: () => ({ createSignedUrls, createSignedUrl }) } }),
}));
// Next's shared data cache, stood in for by a plain map (keyed as Next keys it).
const shared = new Map<string, unknown>();
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>, key: string[]) => async () => {
    const k = key.join("|");
    if (!shared.has(k)) shared.set(k, await fn());
    return shared.get(k);
  },
}));

const BASE = "https://proj.supabase.co/storage/v1/object/public/media/";

describe("signMedia", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co");
    createSignedUrls.mockReset();
    createSignedUrl.mockReset();
    shared.clear();
    let n = 0;
    createSignedUrl.mockImplementation(async (p: string) => ({ data: { signedUrl: `https://proj.supabase.co/storage/v1/object/sign/media/${p}?token=t${n++}` }, error: null }));
  });

  it("swaps memory addresses anywhere in the data, leaves everything else alone", async () => {
    const { signMedia } = await import("./signedMedia");
    const data = {
      rows: [{ public_url: `${BASE}u1/events/e1/a.jpg`, spotify: "https://i.scdn.co/x", n: 3 }],
      cover_url: `${BASE}u1/events/e1/a.jpg`,
      avatar: "https://proj.supabase.co/storage/v1/object/public/avatars/u1/avatar/p.jpg",
      when: null,
    };
    const out = await signMedia(data);
    expect(out.rows[0].public_url).toBe("https://proj.supabase.co/storage/v1/object/sign/media/u1/events/e1/a.jpg?token=t0");
    expect(out.cover_url).toBe(out.rows[0].public_url); // same file → same link
    expect(out.rows[0].spotify).toBe("https://i.scdn.co/x");
    expect(out.avatar).toContain("/public/avatars/");
    expect(out.rows[0].n).toBe(3);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
    expect(createSignedUrl.mock.calls[0][0]).toBe("u1/events/e1/a.jpg");
    expect(data.rows[0].public_url).toContain("/public/media/"); // the original isn't mutated
  });

  it("reuses a link for a while instead of signing again", async () => {
    const { signMedia } = await import("./signedMedia");
    await signMedia(`${BASE}u1/a.jpg`);
    await signMedia(`${BASE}u1/a.jpg`);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("hands every server the same link within a 12-hour window, and a new one after", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T01:00:00Z"));
    const first = (await (await import("./signedMedia")).signMedia(`${BASE}u1/b.jpg`)) as string;
    // Another server (no memory of its own) in the same window: the same link.
    vi.resetModules();
    vi.setSystemTime(new Date("2026-11-17T11:00:00Z"));
    const other = (await (await import("./signedMedia")).signMedia(`${BASE}u1/b.jpg`)) as string;
    expect(other).toBe(first);
    // The next window: a fresh link.
    vi.resetModules();
    vi.setSystemTime(new Date("2026-11-17T13:00:00Z"));
    const later = (await (await import("./signedMedia")).signMedia(`${BASE}u1/b.jpg`)) as string;
    expect(later).not.toBe(first);
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("does nothing when there's nothing to sign", async () => {
    const { signMedia } = await import("./signedMedia");
    const data = { a: "hello" };
    expect(await signMedia(data)).toBe(data);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const createSignedUrls = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ storage: { from: () => ({ createSignedUrls }) } }),
}));

const BASE = "https://proj.supabase.co/storage/v1/object/public/media/";

describe("signMedia", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co");
    createSignedUrls.mockReset();
    createSignedUrls.mockImplementation(async (paths: string[]) => ({
      data: paths.map((p) => ({ path: p, signedUrl: `https://proj.supabase.co/storage/v1/object/sign/media/${p}?token=t`, error: null })),
    }));
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
    expect(out.rows[0].public_url).toBe("https://proj.supabase.co/storage/v1/object/sign/media/u1/events/e1/a.jpg?token=t");
    expect(out.cover_url).toBe(out.rows[0].public_url); // same file → same link
    expect(out.rows[0].spotify).toBe("https://i.scdn.co/x");
    expect(out.avatar).toContain("/public/avatars/");
    expect(out.rows[0].n).toBe(3);
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls.mock.calls[0][0]).toEqual(["u1/events/e1/a.jpg"]);
    expect(data.rows[0].public_url).toContain("/public/media/"); // the original isn't mutated
  });

  it("reuses a link for a while instead of signing again", async () => {
    const { signMedia } = await import("./signedMedia");
    await signMedia(`${BASE}u1/a.jpg`);
    await signMedia(`${BASE}u1/a.jpg`);
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
  });

  it("does nothing when there's nothing to sign", async () => {
    const { signMedia } = await import("./signedMedia");
    const data = { a: "hello" };
    expect(await signMedia(data)).toBe(data);
    expect(createSignedUrls).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml, unsubscribeToken, unsubscribeUrl, verifyUnsubscribeToken } from "./unsubscribe";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  process.env.CRON_SECRET = "test-secret";
  delete process.env.UNSUBSCRIBE_SECRET;
});

describe("unsubscribe links", () => {
  it("accepts the token made for that person", () => {
    expect(verifyUnsubscribeToken(A, unsubscribeToken(A))).toBe(true);
  });
  it("rejects a token made for someone else", () => {
    expect(verifyUnsubscribeToken(B, unsubscribeToken(A))).toBe(false);
  });
  it("rejects garbage, empty and truncated tokens", () => {
    for (const bad of ["", "abc", "zz".repeat(32), unsubscribeToken(A).slice(0, 20)]) expect(verifyUnsubscribeToken(A, bad)).toBe(false);
  });
  it("rejects tokens signed with a different secret", () => {
    const t = unsubscribeToken(A);
    process.env.CRON_SECRET = "other";
    expect(verifyUnsubscribeToken(A, t)).toBe(false);
  });
  it("builds a usable URL", () => {
    const url = new URL(unsubscribeUrl(A));
    expect(url.pathname).toBe("/api/unsubscribe");
    expect(url.searchParams.get("u")).toBe(A);
    expect(verifyUnsubscribeToken(A, url.searchParams.get("t")!)).toBe(true);
  });
});

describe("escapeHtml", () => {
  it("neutralises markup in a display name", () => {
    expect(escapeHtml(`<a href="x">Bob & 'co'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;Bob &amp; &#39;co&#39;&lt;/a&gt;");
  });
});

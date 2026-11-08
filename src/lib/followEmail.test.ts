import { beforeEach, describe, expect, it } from "vitest";
import { followEmail } from "./followEmail";
import { unsubscribeToken, unsubscribeUrl, verifyUnsubscribeToken } from "./unsubscribe";

const A = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  process.env.CRON_SECRET = "test-secret";
  delete process.env.UNSUBSCRIBE_SECRET;
});

describe("follow emails", () => {
  it("escapes names and carries the unsubscribe link", () => {
    const { subject, html } = followEmail({ followerName: "<b>Eve</b>\nX", followerUsername: "eve", followeeName: "Ann & co", unsubscribe: "https://x/u" });
    expect(subject).toBe("<b>Eve</b> X started following you");
    expect(html).toContain("&lt;b&gt;Eve&lt;/b&gt;");
    expect(html).toContain("Ann &amp; co");
    expect(html).toContain('href="https://x/u"');
  });

  it("signs follow unsubscribes separately from the digest", () => {
    const url = new URL(unsubscribeUrl(A, "follows"));
    expect(url.searchParams.get("l")).toBe("follows");
    const t = url.searchParams.get("t")!;
    expect(verifyUnsubscribeToken(A, t, "follows")).toBe(true);
    // A follow link can't switch off the digest, and the other way round.
    expect(verifyUnsubscribeToken(A, t, "digest")).toBe(false);
    expect(verifyUnsubscribeToken(A, unsubscribeToken(A), "follows")).toBe(false);
  });

  it("keeps digest links already sent working", () => {
    expect(new URL(unsubscribeUrl(A)).searchParams.has("l")).toBe(false);
    expect(verifyUnsubscribeToken(A, unsubscribeToken(A))).toBe(true);
  });
});

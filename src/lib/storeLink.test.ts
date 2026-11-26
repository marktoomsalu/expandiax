import { describe, expect, it } from "vitest";
import { CHANNELS, phoneOf, storeTarget } from "./storeLink";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

describe("store links", () => {
  it("knows the phone", () => {
    expect(phoneOf(IPHONE)).toBe("ios");
    expect(phoneOf(ANDROID)).toBe("android");
    expect(phoneOf(MAC)).toBeNull();
    expect(phoneOf(null)).toBeNull();
  });

  it("sends Android to Google Play with where they came from", () => {
    const url = new URL(storeTarget(ANDROID, CHANNELS.yt));
    expect(url.host).toBe("play.google.com");
    expect(url.searchParams.get("id")).toBe("com.expandiax.travelapp");
    expect(url.searchParams.get("referrer")).toBe("utm_source=youtube&utm_medium=video&utm_campaign=intro");
  });

  it("sends iPhone to the App Store as the YouTube campaign", () => {
    expect(storeTarget(IPHONE, CHANNELS.yt)).toBe("https://apps.apple.com/app/apple-store/id6799725181?pt=129264299&ct=ExpandiaX%20YouTube&mt=8");
  });

  it("sends computers to the homepage, tagged", () => {
    expect(storeTarget(MAC, CHANNELS.yt)).toBe("/?utm_source=youtube&utm_medium=video&utm_campaign=intro");
  });
});

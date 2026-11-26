// Short links for channels (expandiax.app/yt, …): one link in a video's
// description that takes each visitor to the right store, tagged with where
// they came from, so downloads can be counted by channel.
//   iPhone  → App Store campaign link (App Store Connect → Analytics → Campaigns)
//   Android → Google Play with a referrer (Play Console → acquisition by source)
//   anything else → the homepage, with UTM tags (it has both store badges)
import { APP_STORE_ID, PLAY_STORE_ID } from "@/lib/appStore";

/**
 * App Store Connect's provider token (pt): the same for every campaign. It
 * appears the first time a campaign link is generated in App Store Connect
 * (Analytics → Acquisition → Campaigns). Until it's set, iPhone visitors still
 * reach the store, just without the campaign tag.
 */
export const APP_STORE_PROVIDER_TOKEN = "129264299";

/** `appStore`: the campaign's name as generated in App Store Connect (its ct, up to 40 characters). */
export type Channel = { source: string; medium: string; campaign: string; appStore: string };

export const CHANNELS = {
  yt: { source: "youtube", medium: "video", campaign: "intro", appStore: "ExpandiaX YouTube" },
} satisfies Record<string, Channel>;

export function phoneOf(userAgent: string | null | undefined): "ios" | "android" | null {
  const ua = userAgent ?? "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipod|ipad/i.test(ua)) return "ios";
  return null;
}

/** Where a visitor on this device goes (a path for the homepage, otherwise a full URL). */
export function storeTarget(userAgent: string | null | undefined, c: Channel): string {
  const utm = `utm_source=${c.source}&utm_medium=${c.medium}&utm_campaign=${c.campaign}`;
  const phone = phoneOf(userAgent);
  if (phone === "android") return `https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}&referrer=${encodeURIComponent(utm)}`;
  if (phone === "ios") {
    if (!APP_STORE_PROVIDER_TOKEN) return `https://apps.apple.com/app/id${APP_STORE_ID}`;
    const ct = c.appStore.slice(0, 40);
    return `https://apps.apple.com/app/apple-store/id${APP_STORE_ID}?pt=${APP_STORE_PROVIDER_TOKEN}&ct=${encodeURIComponent(ct)}&mt=8`;
  }
  return `/?${utm}`;
}

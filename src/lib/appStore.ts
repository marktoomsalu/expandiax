// Plain constants (usable on the server too; the badges are a client file).
export const APP_STORE_ID = "6799725181";
export const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;

export const PLAY_STORE_ID = "com.expandiax.travelapp";
/** Google Play, with where the visitor came from (Play Console shows installs by source). */
export function playStoreUrl(source: "website" | "invite" = "website") {
  return `https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}&referrer=${encodeURIComponent(`utm_source=${source}`)}`;
}
export const PLAY_STORE_URL = playStoreUrl();

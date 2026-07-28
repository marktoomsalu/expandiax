import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

let messaging: Messaging | null = null;

export function getFirebaseMessaging(): Messaging {
  if (messaging) return messaging;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("not_configured");
  const app: App = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(json)) });
  messaging = getMessaging(app);
  return messaging;
}

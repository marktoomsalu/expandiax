import { Purchases, PURCHASES_ERROR_CODE, type PurchasesError } from "@revenuecat/purchases-capacitor";

export const PREMIUM_ENTITLEMENT_ID = "premium";

let configuredForUserId: string | null = null;

/** Mirrors PushRegistration.tsx's pattern: called once userId is known. */
export async function configureRevenueCat(userId: string): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY;
  if (!apiKey) return; // Not configured in this environment — purchase UI stays hidden, see BillingActions.
  if (configuredForUserId === userId) return;

  if (configuredForUserId === null) {
    await Purchases.configure({ apiKey, appUserID: userId });
  } else {
    // Switching accounts on the same device without killing the app
    // (sign out -> sign in as someone else) — logIn/logOut is the
    // supported way to do this, not re-calling configure().
    await Purchases.logOut();
    await Purchases.logIn({ appUserID: userId });
  }
  configuredForUserId = userId;
}

export async function purchasePremium(): Promise<{ isPremium: boolean }> {
  const offerings = await Purchases.getOfferings();
  const aPackage = offerings.current?.availablePackages[0];
  if (!aPackage) throw new Error("Premium isn't available for purchase right now.");
  const { customerInfo } = await Purchases.purchasePackage({ aPackage });
  return { isPremium: Boolean(customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID]) };
}

export async function restorePurchases(): Promise<{ isPremium: boolean }> {
  const { customerInfo } = await Purchases.restorePurchases();
  return { isPremium: Boolean(customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID]) };
}

/** RevenueCat-provided deep link that already points at the right store (App Store/Play Store) for this customer — null if there's no active subscription to manage. */
export async function getManagementUrl(): Promise<string | null> {
  const { customerInfo } = await Purchases.getCustomerInfo();
  return customerInfo.managementURL;
}

export function isPurchaseCancelled(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as PurchasesError).code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}

export type PremiumProductInfo = { title: string; priceString: string; period: string | null };

// Apple requires the subscription's real title, length and price to be
// shown in the app's own purchase flow (Guideline 3.1.2(c)) — not just on
// the system StoreKit sheet. Pulling it live from the store, rather than a
// hardcoded string, is also the only way the price is accurate in every
// storefront/currency.
export async function getPremiumProduct(): Promise<PremiumProductInfo | null> {
  const offerings = await Purchases.getOfferings();
  const aPackage = offerings.current?.availablePackages[0];
  if (!aPackage) return null;
  const { title, priceString, subscriptionPeriod } = aPackage.product;
  return { title, priceString, period: subscriptionPeriod };
}

/** "P1M" -> "Every month", "P3M" -> "Every 3 months", null -> a safe generic label. */
export function subscriptionPeriodLabel(iso: string | null): string {
  const match = iso ? /^P(\d+)?([DWMY])$/.exec(iso) : null;
  if (!match) return "Auto-renewing subscription";
  const count = match[1] ? parseInt(match[1], 10) : 1;
  const unit = { D: "day", W: "week", M: "month", Y: "year" }[match[2] as "D" | "W" | "M" | "Y"];
  return count === 1 ? `Every ${unit}` : `Every ${count} ${unit}s`;
}

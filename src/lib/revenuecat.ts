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

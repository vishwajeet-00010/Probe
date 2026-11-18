"use client";
/**
 * Billing via RevenueCat Web Billing (no server of our own). The RevenueCat
 * appUserId is the organizationId, so one Owner purchase covers the whole team
 * on web, iOS and Android. Entitlement identifiers: "pro" and "group".
 *
 * Limitation (documented): Firestore rules cannot see RevenueCat, so plan
 * limits are enforced in the apps. Move to Blaze + the RevenueCat Firebase
 * extension to enforce them in security rules.
 */
import { ErrorCode, Purchases, PurchasesError } from "@revenuecat/purchases-js";

export type Plan = "Free" | "Pro" | "Group";
const apiKey = () => process.env.NEXT_PUBLIC_REVENUECAT_WEB_API_KEY ?? "";

export const billingConfigured = () => Boolean(apiKey());

async function purchases(organizationId: string) {
  if (!Purchases.isConfigured())
    return Purchases.configure({ apiKey: apiKey(), appUserId: organizationId });
  const shared = Purchases.getSharedInstance();
  if (shared.getAppUserId() !== organizationId)
    await shared.changeUser(organizationId);
  return shared;
}

export async function entitledPlan(organizationId: string): Promise<Plan> {
  if (!billingConfigured()) return "Free";
  const info = await (await purchases(organizationId)).getCustomerInfo();
  if ("group" in info.entitlements.active) return "Group";
  if ("pro" in info.entitlements.active) return "Pro";
  return "Free";
}

/** Opens RevenueCat's hosted checkout for the "pro" or "group" offering. */
export async function purchasePlan(
  organizationId: string,
  plan: Exclude<Plan, "Free">,
  email?: string,
) {
  if (!billingConfigured())
    throw new Error("Billing is not configured for this environment.");
  const p = await purchases(organizationId);
  const offerings = await p.getOfferings();
  const offering = offerings.all[plan.toLowerCase()] ?? offerings.current;
  const rcPackage = offering?.availablePackages[0];
  if (!rcPackage)
    throw new Error(`No ${plan} offering is configured in RevenueCat.`);
  try {
    await p.purchase({ rcPackage, customerEmail: email });
    return true;
  } catch (e) {
    if (
      e instanceof PurchasesError &&
      e.errorCode === ErrorCode.UserCancelledError
    )
      return false;
    throw e;
  }
}

export async function managementUrl(organizationId: string) {
  if (!billingConfigured()) return null;
  const info = await (await purchases(organizationId)).getCustomerInfo();
  return info.managementURL;
}

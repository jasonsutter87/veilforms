/**
 * VeilForms - Subscription Limits Configuration
 * Centralized configuration for subscription tier limits
 */

export const SUBSCRIPTION_TIERS = {
  free: { forms: 5, submissions: 100, retention: 7, customDomains: 0 },
  starter: { forms: 20, submissions: 1000, retention: 30, customDomains: 0 },
  pro: { forms: 50, submissions: 10000, retention: 90, customDomains: 0 },
  business: { forms: Infinity, submissions: 50000, retention: 180, customDomains: 1 },
  enterprise: { forms: Infinity, submissions: Infinity, retention: 365, customDomains: 5 },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;

/**
 * Get the form creation limit for a subscription tier
 */
export function getFormLimit(tier: string): number {
  return SUBSCRIPTION_TIERS[tier as SubscriptionTier]?.forms ?? SUBSCRIPTION_TIERS.free.forms;
}

/**
 * Get the submission limit for a subscription tier
 */
export function getSubmissionLimit(tier: string): number {
  return SUBSCRIPTION_TIERS[tier as SubscriptionTier]?.submissions ?? SUBSCRIPTION_TIERS.free.submissions;
}

/**
 * Get the retention period in days for a subscription tier
 */
export function getRetentionDays(tier: string): number {
  return SUBSCRIPTION_TIERS[tier as SubscriptionTier]?.retention ?? SUBSCRIPTION_TIERS.free.retention;
}

/**
 * Get the custom domain limit for a subscription tier
 */
export function getCustomDomainLimit(tier: string): number {
  return SUBSCRIPTION_TIERS[tier as SubscriptionTier]?.customDomains ?? SUBSCRIPTION_TIERS.free.customDomains;
}

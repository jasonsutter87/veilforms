/**
 * VeilForms - Stripe Integration Library
 */

import Stripe from "stripe";
import { User } from "./storage";

// Lazy initialize Stripe to avoid build-time errors
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    _stripe = new Stripe(secretKey, {
      apiVersion: "2025-12-15.clover",
    });
  }
  return _stripe;
}

// Export a proxy for backwards compatibility
const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Plan configuration
interface PlanLimits {
  maxForms: number;
  submissionsPerMonth: number;
  retentionDays: number;
  webhooks: boolean;
  customBranding: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
}

interface PlanConfig {
  name: string;
  priceId: string | null;
  monthlyPrice: number | null;
  limits: PlanLimits;
}

export const PLAN_CONFIG: Record<string, PlanConfig> = {
  free: {
    name: "Free",
    priceId: null,
    monthlyPrice: 0,
    limits: {
      maxForms: 3,
      submissionsPerMonth: 100,
      retentionDays: 7,
      webhooks: false,
      customBranding: false,
      apiAccess: false,
      prioritySupport: false,
    },
  },
  pro: {
    name: "Pro",
    priceId: process.env.STRIPE_PRICE_PRO || null,
    monthlyPrice: 19,
    limits: {
      maxForms: 25,
      submissionsPerMonth: 5000,
      retentionDays: 30,
      webhooks: true,
      customBranding: true,
      apiAccess: true,
      prioritySupport: false,
    },
  },
  team: {
    name: "Team",
    priceId: process.env.STRIPE_PRICE_TEAM || null,
    monthlyPrice: 49,
    limits: {
      maxForms: -1, // Unlimited
      submissionsPerMonth: 25000,
      retentionDays: 365,
      webhooks: true,
      customBranding: true,
      apiAccess: true,
      prioritySupport: true,
    },
  },
  enterprise: {
    name: "Enterprise",
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || null,
    monthlyPrice: null, // Custom pricing
    limits: {
      maxForms: -1,
      submissionsPerMonth: -1,
      retentionDays: -1,
      webhooks: true,
      customBranding: true,
      apiAccess: true,
      prioritySupport: true,
    },
  },
};

export interface SubscriptionData {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  plan: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  trialEnd: string | null;
}

/**
 * Get plan configuration by plan name
 */
export function getPlanConfig(planName: string): PlanConfig {
  const config = PLAN_CONFIG[planName];
  const freeConfig = PLAN_CONFIG.free;
  return config ?? freeConfig ?? {
    name: "Free",
    priceId: null,
    monthlyPrice: 0,
    limits: {
      maxForms: 3,
      submissionsPerMonth: 100,
      retentionDays: 7,
      webhooks: false,
      customBranding: false,
      apiAccess: false,
      prioritySupport: false,
    },
  };
}

/**
 * Get plan limits for a user's subscription
 */
export function getPlanLimits(planName: string): PlanLimits {
  const config = getPlanConfig(planName);
  return config.limits;
}

/**
 * Create or get a Stripe customer for a user
 */
export async function getOrCreateCustomer(
  user: User
): Promise<Stripe.Customer> {
  const extUser = user as User & { stripeCustomerId?: string };

  // If user already has a Stripe customer ID, retrieve it
  if (extUser.stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(extUser.stripeCustomerId);
      if (!(customer as Stripe.DeletedCustomer).deleted) {
        return customer as Stripe.Customer;
      }
    } catch {
      // Customer doesn't exist, create new one
    }
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: {
      userId: user.id,
      environment: process.env.NODE_ENV || "development",
    },
  });

  return customer;
}

/**
 * Create a checkout session for plan upgrade
 */
export async function createCheckoutSession({
  user,
  planName,
  successUrl,
  cancelUrl,
}: {
  user: User;
  planName: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const planConfig = getPlanConfig(planName);

  if (!planConfig.priceId) {
    throw new Error(`No Stripe price configured for plan: ${planName}`);
  }

  // Get or create customer
  const customer = await getOrCreateCustomer(user);

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: planConfig.priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        userId: user.id,
        planName: planName,
      },
    },
    metadata: {
      userId: user.id,
      planName: planName,
    },
    allow_promotion_codes: true,
    billing_address_collection: "auto",
  });

  return session;
}

/**
 * Create a customer portal session
 */
export async function createPortalSession(
  stripeCustomerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  return session;
}

/**
 * Get subscription details
 */
export async function getSubscription(
  stripeSubscriptionId: string
): Promise<Stripe.Subscription | null> {
  if (!stripeSubscriptionId) return null;

  try {
    const subscription = await stripe.subscriptions.retrieve(
      stripeSubscriptionId
    );
    return subscription;
  } catch {
    return null;
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  stripeSubscriptionId: string,
  immediate = false
): Promise<Stripe.Subscription> {
  if (immediate) {
    return await stripe.subscriptions.cancel(stripeSubscriptionId);
  } else {
    return await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }
}

/**
 * Reactivate a subscription
 */
export async function reactivateSubscription(
  stripeSubscriptionId: string
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * Construct and verify a webhook event
 */
export function constructWebhookEvent(
  payload: string,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET || ""
  );
}

/**
 * Map Stripe subscription status
 */
export function mapSubscriptionStatus(stripeStatus: string): string {
  const statusMap: Record<string, string> = {
    active: "active",
    past_due: "past_due",
    unpaid: "past_due",
    canceled: "canceled",
    incomplete: "incomplete",
    incomplete_expired: "canceled",
    trialing: "active",
    paused: "paused",
  };
  return statusMap[stripeStatus] || "unknown";
}

/**
 * Get plan name from Stripe price ID
 */
export function getPlanFromPriceId(priceId: string): string {
  for (const [planName, config] of Object.entries(PLAN_CONFIG)) {
    if (config.priceId === priceId) {
      return planName;
    }
  }
  return "free";
}

/**
 * Format subscription data for storage
 */
export function formatSubscriptionData(
  subscription: Stripe.Subscription
): SubscriptionData {
  const priceId = subscription.items.data[0]?.price?.id || "";
  const planName = getPlanFromPriceId(priceId);

  // Cast to access subscription fields that exist in the API response
  const subData = subscription as unknown as {
    id: string;
    customer: string;
    status: string;
    current_period_start: number;
    current_period_end: number;
    cancel_at_period_end: boolean;
    canceled_at?: number;
    trial_end?: number;
  };

  return {
    stripeSubscriptionId: subData.id,
    stripeCustomerId: subData.customer,
    stripePriceId: priceId,
    plan: planName,
    status: mapSubscriptionStatus(subData.status),
    currentPeriodStart: new Date(
      subData.current_period_start * 1000
    ).toISOString(),
    currentPeriodEnd: new Date(
      subData.current_period_end * 1000
    ).toISOString(),
    cancelAtPeriodEnd: subData.cancel_at_period_end,
    canceledAt: subData.canceled_at
      ? new Date(subData.canceled_at * 1000).toISOString()
      : null,
    trialEnd: subData.trial_end
      ? new Date(subData.trial_end * 1000).toISOString()
      : null,
  };
}

export { stripe };

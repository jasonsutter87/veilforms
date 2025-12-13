import Stripe from 'stripe';

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Plan configuration - maps internal plan names to Stripe price IDs
export const PLAN_CONFIG = {
  free: {
    name: 'Free',
    priceId: null, // No Stripe price for free
    monthlyPrice: 0,
    limits: {
      maxForms: 3,
      submissionsPerMonth: 100,
      retentionDays: 7,
      webhooks: false,
      customBranding: false,
      apiAccess: false,
      prioritySupport: false
    }
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRICE_PRO,
    monthlyPrice: 19,
    limits: {
      maxForms: 25,
      submissionsPerMonth: 5000,
      retentionDays: 30,
      webhooks: true,
      customBranding: true,
      apiAccess: true,
      prioritySupport: false
    }
  },
  team: {
    name: 'Team',
    priceId: process.env.STRIPE_PRICE_TEAM,
    monthlyPrice: 49,
    limits: {
      maxForms: -1, // Unlimited
      submissionsPerMonth: 25000,
      retentionDays: 365,
      webhooks: true,
      customBranding: true,
      apiAccess: true,
      prioritySupport: true
    }
  },
  enterprise: {
    name: 'Enterprise',
    priceId: process.env.STRIPE_PRICE_ENTERPRISE,
    monthlyPrice: null, // Custom pricing
    limits: {
      maxForms: -1,
      submissionsPerMonth: -1,
      retentionDays: -1, // Custom
      webhooks: true,
      customBranding: true,
      apiAccess: true,
      prioritySupport: true
    }
  }
};

/**
 * Get plan configuration by plan name
 */
export function getPlanConfig(planName) {
  return PLAN_CONFIG[planName] || PLAN_CONFIG.free;
}

/**
 * Get plan limits for a user's subscription
 */
export function getPlanLimits(planName) {
  const config = getPlanConfig(planName);
  return config.limits;
}

/**
 * Check if user can create more forms
 */
export function canCreateForm(planName, currentFormCount) {
  const limits = getPlanLimits(planName);
  if (limits.maxForms === -1) return true; // Unlimited
  return currentFormCount < limits.maxForms;
}

/**
 * Check if form can accept more submissions this month
 */
export function canAcceptSubmission(planName, monthlySubmissionCount) {
  const limits = getPlanLimits(planName);
  if (limits.submissionsPerMonth === -1) return true; // Unlimited
  return monthlySubmissionCount < limits.submissionsPerMonth;
}

/**
 * Create or get a Stripe customer for a user
 */
export async function getOrCreateCustomer(user) {
  // If user already has a Stripe customer ID, retrieve it
  if (user.stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(user.stripeCustomerId);
      if (!customer.deleted) {
        return customer;
      }
    } catch (e) {
      // Customer doesn't exist, create new one
    }
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: {
      userId: user.id,
      environment: process.env.CONTEXT || 'development'
    }
  });

  return customer;
}

/**
 * Create a checkout session for plan upgrade
 */
export async function createCheckoutSession({ user, planName, successUrl, cancelUrl }) {
  const planConfig = getPlanConfig(planName);

  if (!planConfig.priceId) {
    throw new Error(`No Stripe price configured for plan: ${planName}`);
  }

  // Get or create customer
  const customer = await getOrCreateCustomer(user);

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: planConfig.priceId,
        quantity: 1
      }
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        userId: user.id,
        planName: planName
      }
    },
    metadata: {
      userId: user.id,
      planName: planName
    },
    allow_promotion_codes: true,
    billing_address_collection: 'auto'
  });

  return session;
}

/**
 * Create a customer portal session for managing subscription
 */
export async function createPortalSession(stripeCustomerId, returnUrl) {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl
  });

  return session;
}

/**
 * Get subscription details
 */
export async function getSubscription(stripeSubscriptionId) {
  if (!stripeSubscriptionId) return null;

  try {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    return subscription;
  } catch (e) {
    return null;
  }
}

/**
 * Cancel a subscription (at period end)
 */
export async function cancelSubscription(stripeSubscriptionId, immediate = false) {
  if (immediate) {
    return await stripe.subscriptions.cancel(stripeSubscriptionId);
  } else {
    return await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true
    });
  }
}

/**
 * Reactivate a subscription that was set to cancel
 */
export async function reactivateSubscription(stripeSubscriptionId) {
  return await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false
  });
}

/**
 * Construct and verify a webhook event
 */
export function constructWebhookEvent(payload, signature) {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}

/**
 * Map Stripe subscription status to our internal status
 */
export function mapSubscriptionStatus(stripeStatus) {
  const statusMap = {
    'active': 'active',
    'past_due': 'past_due',
    'unpaid': 'past_due',
    'canceled': 'canceled',
    'incomplete': 'incomplete',
    'incomplete_expired': 'canceled',
    'trialing': 'active',
    'paused': 'paused'
  };
  return statusMap[stripeStatus] || 'unknown';
}

/**
 * Get plan name from Stripe price ID
 */
export function getPlanFromPriceId(priceId) {
  for (const [planName, config] of Object.entries(PLAN_CONFIG)) {
    if (config.priceId === priceId) {
      return planName;
    }
  }
  return 'free';
}

/**
 * Format subscription data for storage
 */
export function formatSubscriptionData(subscription) {
  const priceId = subscription.items.data[0]?.price?.id;
  const planName = getPlanFromPriceId(priceId);

  return {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer,
    stripePriceId: priceId,
    plan: planName,
    status: mapSubscriptionStatus(subscription.status),
    currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
  };
}

export { stripe };

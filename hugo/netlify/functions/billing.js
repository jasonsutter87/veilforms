/**
 * VeilForms - Billing & Subscription Endpoint
 * POST /api/billing/checkout - Create checkout session
 * POST /api/billing/portal - Create customer portal session
 * GET /api/billing/subscription - Get subscription status
 * POST /api/billing/cancel - Cancel subscription
 * POST /api/billing/reactivate - Reactivate canceled subscription
 */

import { authenticateRequest } from './lib/auth.js';
import { getUser, updateUser } from './lib/storage.js';
import {
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  cancelSubscription,
  reactivateSubscription,
  getPlanConfig,
  getPlanLimits,
  formatSubscriptionData
} from './lib/stripe.js';
import { logAudit, AuditEvents, getAuditContext } from './lib/audit.js';
import { getCorsHeaders } from './lib/cors.js';
import * as response from './lib/responses.js';

export default async function handler(req, context) {
  const origin = req.headers.get('origin') || '';
  const headers = getCorsHeaders(origin, {
    methods: ['GET', 'POST', 'OPTIONS']
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return response.noContent(headers);
  }

  // Parse path to get action
  const url = new URL(req.url);
  const pathParts = url.pathname.replace('/api/billing', '').split('/').filter(Boolean);
  const action = pathParts[0] || '';

  try {
    // Authenticate user
    const auth = await authenticateRequest(req);
    if (!auth.success) {
      return response.unauthorized(auth.error, headers);
    }

    const user = await getUser(auth.email);
    if (!user) {
      return response.notFound('User not found', headers);
    }

    switch (action) {
      case 'checkout':
        return handleCheckout(req, user, headers);
      case 'portal':
        return handlePortal(req, user, headers);
      case 'subscription':
        return handleGetSubscription(req, user, headers);
      case 'cancel':
        return handleCancel(req, user, headers);
      case 'reactivate':
        return handleReactivate(req, user, headers);
      default:
        return response.notFound('Endpoint not found', headers);
    }
  } catch (error) {
    console.error('Billing error:', error);
    return response.serverError(headers, 'An error occurred processing your request');
  }
}

/**
 * Create a Stripe checkout session for plan upgrade
 */
async function handleCheckout(req, user, headers) {
  if (req.method !== 'POST') {
    return response.methodNotAllowed(headers);
  }

  const body = await req.json();
  const { plan } = body;

  // Validate plan
  const planConfig = getPlanConfig(plan);
  if (!planConfig || !planConfig.priceId) {
    return response.badRequest('Invalid plan selected', headers);
  }

  // Check if user is already on this plan
  if (user.subscription === plan) {
    return response.badRequest('You are already subscribed to this plan', headers);
  }

  try {
    // Create success and cancel URLs
    const baseUrl = process.env.URL || 'http://localhost:1313';
    const successUrl = `${baseUrl}/dashboard?billing=success&plan=${plan}`;
    const cancelUrl = `${baseUrl}/dashboard?billing=canceled`;

    const session = await createCheckoutSession({
      user,
      planName: plan,
      successUrl,
      cancelUrl
    });

    // Update user with Stripe customer ID if new
    if (session.customer && !user.stripeCustomerId) {
      await updateUser(user.email, {
        stripeCustomerId: session.customer
      });
    }

    await logAudit(AuditEvents.BILLING_CHECKOUT_STARTED, {
      userId: user.id,
      plan,
      sessionId: session.id
    });

    return response.success({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id
    }, headers);
  } catch (error) {
    console.error('Checkout error:', error);
    return response.serverError(headers, error.message || 'Failed to create checkout session');
  }
}

/**
 * Create a Stripe customer portal session for managing subscription
 */
async function handlePortal(req, user, headers) {
  if (req.method !== 'POST') {
    return response.methodNotAllowed(headers);
  }

  if (!user.stripeCustomerId) {
    return response.badRequest('No active subscription found', headers);
  }

  try {
    const baseUrl = process.env.URL || 'http://localhost:1313';
    const returnUrl = `${baseUrl}/dashboard?section=settings`;

    const session = await createPortalSession(user.stripeCustomerId, returnUrl);

    return response.success({
      success: true,
      portalUrl: session.url
    }, headers);
  } catch (error) {
    console.error('Portal error:', error);
    return response.serverError(headers, 'Failed to create portal session');
  }
}

/**
 * Get current subscription status
 */
async function handleGetSubscription(req, user, headers) {
  if (req.method !== 'GET') {
    return response.methodNotAllowed(headers);
  }

  const planConfig = getPlanConfig(user.subscription || 'free');
  const limits = getPlanLimits(user.subscription || 'free');

  // If user has active subscription, get details from Stripe
  let subscriptionDetails = null;
  if (user.stripeSubscriptionId) {
    const subscription = await getSubscription(user.stripeSubscriptionId);
    if (subscription) {
      subscriptionDetails = formatSubscriptionData(subscription);
    }
  }

  return response.success({
    success: true,
    subscription: {
      plan: user.subscription || 'free',
      planName: planConfig.name,
      monthlyPrice: planConfig.monthlyPrice,
      limits,
      status: subscriptionDetails?.status || (user.subscription === 'free' ? 'active' : 'unknown'),
      ...subscriptionDetails
    }
  }, headers);
}

/**
 * Cancel subscription (at period end)
 */
async function handleCancel(req, user, headers) {
  if (req.method !== 'POST') {
    return response.methodNotAllowed(headers);
  }

  if (!user.stripeSubscriptionId) {
    return response.badRequest('No active subscription to cancel', headers);
  }

  try {
    const subscription = await cancelSubscription(user.stripeSubscriptionId, false);

    await logAudit(AuditEvents.SUBSCRIPTION_CANCELED, {
      userId: user.id,
      subscriptionId: user.stripeSubscriptionId,
      cancelAt: subscription.current_period_end
    });

    return response.success({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period',
      cancelAt: new Date(subscription.current_period_end * 1000).toISOString()
    }, headers);
  } catch (error) {
    console.error('Cancel error:', error);
    return response.serverError(headers, 'Failed to cancel subscription');
  }
}

/**
 * Reactivate a subscription that was set to cancel
 */
async function handleReactivate(req, user, headers) {
  if (req.method !== 'POST') {
    return response.methodNotAllowed(headers);
  }

  if (!user.stripeSubscriptionId) {
    return response.badRequest('No subscription to reactivate', headers);
  }

  try {
    const subscription = await reactivateSubscription(user.stripeSubscriptionId);

    await logAudit(AuditEvents.SUBSCRIPTION_REACTIVATED, {
      userId: user.id,
      subscriptionId: user.stripeSubscriptionId
    });

    return response.success({
      success: true,
      message: 'Subscription reactivated successfully'
    }, headers);
  } catch (error) {
    console.error('Reactivate error:', error);
    return response.serverError(headers, 'Failed to reactivate subscription');
  }
}

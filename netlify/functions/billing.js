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

// CORS headers
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:1313', 'http://localhost:3000'];

function getCorsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

export default async function handler(req, context) {
  const origin = req.headers.get('origin') || '';
  const headers = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // Parse path to get action
  const url = new URL(req.url);
  const pathParts = url.pathname.replace('/api/billing', '').split('/').filter(Boolean);
  const action = pathParts[0] || '';

  try {
    // Authenticate user
    const auth = await authenticateRequest(req);
    if (!auth.success) {
      return new Response(JSON.stringify({ error: 'unauthorized', message: auth.error }), {
        status: 401,
        headers
      });
    }

    const user = await getUser(auth.email);
    if (!user) {
      return new Response(JSON.stringify({ error: 'not_found', message: 'User not found' }), {
        status: 404,
        headers
      });
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
        return new Response(JSON.stringify({ error: 'not_found', message: 'Endpoint not found' }), {
          status: 404,
          headers
        });
    }
  } catch (error) {
    console.error('Billing error:', error);
    return new Response(JSON.stringify({
      error: 'internal_error',
      message: 'An error occurred processing your request'
    }), {
      status: 500,
      headers
    });
  }
}

/**
 * Create a Stripe checkout session for plan upgrade
 */
async function handleCheckout(req, user, headers) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers
    });
  }

  const body = await req.json();
  const { plan } = body;

  // Validate plan
  const planConfig = getPlanConfig(plan);
  if (!planConfig || !planConfig.priceId) {
    return new Response(JSON.stringify({
      error: 'invalid_plan',
      message: 'Invalid plan selected'
    }), {
      status: 400,
      headers
    });
  }

  // Check if user is already on this plan
  if (user.subscription === plan) {
    return new Response(JSON.stringify({
      error: 'already_subscribed',
      message: 'You are already subscribed to this plan'
    }), {
      status: 400,
      headers
    });
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

    return new Response(JSON.stringify({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id
    }), {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(JSON.stringify({
      error: 'checkout_failed',
      message: error.message || 'Failed to create checkout session'
    }), {
      status: 500,
      headers
    });
  }
}

/**
 * Create a Stripe customer portal session for managing subscription
 */
async function handlePortal(req, user, headers) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers
    });
  }

  if (!user.stripeCustomerId) {
    return new Response(JSON.stringify({
      error: 'no_subscription',
      message: 'No active subscription found'
    }), {
      status: 400,
      headers
    });
  }

  try {
    const baseUrl = process.env.URL || 'http://localhost:1313';
    const returnUrl = `${baseUrl}/dashboard?section=settings`;

    const session = await createPortalSession(user.stripeCustomerId, returnUrl);

    return new Response(JSON.stringify({
      success: true,
      portalUrl: session.url
    }), {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('Portal error:', error);
    return new Response(JSON.stringify({
      error: 'portal_failed',
      message: 'Failed to create portal session'
    }), {
      status: 500,
      headers
    });
  }
}

/**
 * Get current subscription status
 */
async function handleGetSubscription(req, user, headers) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers
    });
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

  return new Response(JSON.stringify({
    success: true,
    subscription: {
      plan: user.subscription || 'free',
      planName: planConfig.name,
      monthlyPrice: planConfig.monthlyPrice,
      limits,
      status: subscriptionDetails?.status || (user.subscription === 'free' ? 'active' : 'unknown'),
      ...subscriptionDetails
    }
  }), {
    status: 200,
    headers
  });
}

/**
 * Cancel subscription (at period end)
 */
async function handleCancel(req, user, headers) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers
    });
  }

  if (!user.stripeSubscriptionId) {
    return new Response(JSON.stringify({
      error: 'no_subscription',
      message: 'No active subscription to cancel'
    }), {
      status: 400,
      headers
    });
  }

  try {
    const subscription = await cancelSubscription(user.stripeSubscriptionId, false);

    await logAudit(AuditEvents.SUBSCRIPTION_CANCELED, {
      userId: user.id,
      subscriptionId: user.stripeSubscriptionId,
      cancelAt: subscription.current_period_end
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period',
      cancelAt: new Date(subscription.current_period_end * 1000).toISOString()
    }), {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('Cancel error:', error);
    return new Response(JSON.stringify({
      error: 'cancel_failed',
      message: 'Failed to cancel subscription'
    }), {
      status: 500,
      headers
    });
  }
}

/**
 * Reactivate a subscription that was set to cancel
 */
async function handleReactivate(req, user, headers) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers
    });
  }

  if (!user.stripeSubscriptionId) {
    return new Response(JSON.stringify({
      error: 'no_subscription',
      message: 'No subscription to reactivate'
    }), {
      status: 400,
      headers
    });
  }

  try {
    const subscription = await reactivateSubscription(user.stripeSubscriptionId);

    await logAudit(AuditEvents.SUBSCRIPTION_REACTIVATED, {
      userId: user.id,
      subscriptionId: user.stripeSubscriptionId
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Subscription reactivated successfully'
    }), {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('Reactivate error:', error);
    return new Response(JSON.stringify({
      error: 'reactivate_failed',
      message: 'Failed to reactivate subscription'
    }), {
      status: 500,
      headers
    });
  }
}

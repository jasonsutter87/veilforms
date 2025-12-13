/**
 * VeilForms - Stripe Webhook Handler
 * POST /api/stripe-webhook - Handle Stripe webhook events
 *
 * Handles:
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.paid
 * - invoice.payment_failed
 */

import { updateUser, getUser } from './lib/storage.js';
import {
  constructWebhookEvent,
  formatSubscriptionData,
  getPlanFromPriceId,
  mapSubscriptionStatus
} from './lib/stripe.js';
import { logAudit, AuditEvents } from './lib/audit.js';

export default async function handler(req, context) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return new Response(JSON.stringify({ error: 'missing_signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let event;

  try {
    // Get raw body for signature verification
    const body = await req.text();
    event = constructWebhookEvent(body, signature);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(JSON.stringify({
      error: 'invalid_signature',
      message: 'Webhook signature verification failed'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`Processing Stripe event: ${event.type}`);
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      default:
        if (process.env.NODE_ENV !== 'production') {
          console.log(`Unhandled event type: ${event.type}`);
        }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return new Response(JSON.stringify({
      error: 'handler_error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle new subscription created
 */
async function handleSubscriptionCreated(subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.warn('No userId in subscription metadata');
    return;
  }

  const user = await getUserByStripeCustomer(subscription.customer);
  if (!user) {
    console.warn('User not found for subscription:', subscription.id);
    return;
  }

  const subscriptionData = formatSubscriptionData(subscription);

  await updateUser(user.email, {
    subscription: subscriptionData.plan,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscriptionData.status,
    subscriptionPeriodEnd: subscriptionData.currentPeriodEnd
  });

  await logAudit(AuditEvents.SUBSCRIPTION_CREATED, {
    userId: user.id,
    plan: subscriptionData.plan,
    subscriptionId: subscription.id
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(`Subscription created for user ${user.id}: ${subscriptionData.plan}`);
  }
}

/**
 * Handle subscription updated (plan change, renewal, etc)
 */
async function handleSubscriptionUpdated(subscription) {
  const user = await getUserByStripeCustomer(subscription.customer);
  if (!user) {
    console.warn('User not found for subscription update:', subscription.id);
    return;
  }

  const subscriptionData = formatSubscriptionData(subscription);
  const previousPlan = user.subscription;

  await updateUser(user.email, {
    subscription: subscriptionData.plan,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscriptionData.status,
    subscriptionPeriodEnd: subscriptionData.currentPeriodEnd,
    subscriptionCancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd
  });

  // Log if plan changed
  if (previousPlan !== subscriptionData.plan) {
    await logAudit(AuditEvents.SUBSCRIPTION_PLAN_CHANGED, {
      userId: user.id,
      previousPlan,
      newPlan: subscriptionData.plan,
      subscriptionId: subscription.id
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`Subscription updated for user ${user.id}: ${subscriptionData.plan}`);
  }
}

/**
 * Handle subscription canceled/deleted
 */
async function handleSubscriptionDeleted(subscription) {
  const user = await getUserByStripeCustomer(subscription.customer);
  if (!user) {
    console.warn('User not found for subscription deletion:', subscription.id);
    return;
  }

  const previousPlan = user.subscription;

  // Downgrade to free plan
  await updateUser(user.email, {
    subscription: 'free',
    stripeSubscriptionId: null,
    subscriptionStatus: 'canceled',
    subscriptionPeriodEnd: null,
    subscriptionCancelAtPeriodEnd: false
  });

  await logAudit(AuditEvents.SUBSCRIPTION_CANCELED, {
    userId: user.id,
    previousPlan,
    subscriptionId: subscription.id
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(`Subscription deleted for user ${user.id}, downgraded to free`);
  }
}

/**
 * Handle successful payment
 */
async function handleInvoicePaid(invoice) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const user = await getUserByStripeCustomer(invoice.customer);
  if (!user) return;

  await logAudit(AuditEvents.PAYMENT_SUCCEEDED, {
    userId: user.id,
    amount: invoice.amount_paid / 100,
    currency: invoice.currency,
    invoiceId: invoice.id
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(`Invoice paid for user ${user.id}: $${invoice.amount_paid / 100}`);
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice) {
  const user = await getUserByStripeCustomer(invoice.customer);
  if (!user) return;

  await updateUser(user.email, {
    subscriptionStatus: 'past_due'
  });

  await logAudit(AuditEvents.PAYMENT_FAILED, {
    userId: user.id,
    amount: invoice.amount_due / 100,
    currency: invoice.currency,
    invoiceId: invoice.id,
    attemptCount: invoice.attempt_count
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(`Payment failed for user ${user.id}`);
  }

  // TODO: Send email notification about failed payment
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutCompleted(session) {
  const userId = session.metadata?.userId;
  const planName = session.metadata?.planName;

  if (!userId || !planName) {
    console.warn('Missing metadata in checkout session');
    return;
  }

  // The subscription.created event will handle the actual subscription update
  // This event is mainly for logging/analytics

  await logAudit(AuditEvents.BILLING_CHECKOUT_COMPLETED, {
    userId,
    plan: planName,
    sessionId: session.id,
    customerId: session.customer,
    subscriptionId: session.subscription
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(`Checkout completed for user ${userId}: ${planName}`);
  }
}

/**
 * Helper: Get user by Stripe customer ID
 */
async function getUserByStripeCustomer(customerId) {
  // This is inefficient - in production, you'd want an index
  // For now, we'll search through users or use metadata

  // Try to get from Stripe customer metadata
  try {
    const { stripe } = await import('./lib/stripe.js');
    const customer = await stripe.customers.retrieve(customerId);

    if (customer.metadata?.userId) {
      const { getUserById } = await import('./lib/storage.js');
      return await getUserById(customer.metadata.userId);
    }

    // Fallback: try email lookup
    if (customer.email) {
      return await getUser(customer.email);
    }
  } catch (error) {
    console.error('Error finding user by Stripe customer:', error);
  }

  return null;
}

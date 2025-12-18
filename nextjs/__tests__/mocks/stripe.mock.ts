/**
 * Stripe Mock Factory
 * Provides mock objects for Stripe API responses
 */

import type Stripe from 'stripe';

export interface MockStripeCustomerParams {
  id?: string;
  email?: string;
  metadata?: Record<string, string>;
  deleted?: boolean;
}

export interface MockStripeSubscriptionParams {
  id?: string;
  customer?: string;
  status?: Stripe.Subscription.Status;
  priceId?: string;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: number | null;
  trialEnd?: number | null;
}

export interface MockStripeCheckoutSessionParams {
  id?: string;
  customer?: string;
  mode?: Stripe.Checkout.Session.Mode;
  url?: string;
  metadata?: Record<string, string>;
}

export interface MockStripeBillingPortalSessionParams {
  id?: string;
  customer?: string;
  url?: string;
}

export interface MockStripeEventParams {
  id?: string;
  type?: string;
  data?: {
    object: unknown;
  };
}

/**
 * Create a mock Stripe customer
 */
export function mockStripeCustomer(
  params: MockStripeCustomerParams = {}
): Stripe.Customer | Stripe.DeletedCustomer {
  const {
    id = 'cus_test123',
    email = 'test@example.com',
    metadata = {},
    deleted = false,
  } = params;

  if (deleted) {
    return {
      id,
      object: 'customer',
      deleted: true,
    } as Stripe.DeletedCustomer;
  }

  return {
    id,
    object: 'customer',
    email,
    metadata,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    address: null,
    balance: 0,
    currency: null,
    default_source: null,
    delinquent: false,
    description: null,
    discount: null,
    invoice_prefix: 'TEST',
    invoice_settings: {
      custom_fields: null,
      default_payment_method: null,
      footer: null,
      rendering_options: null,
    },
    name: null,
    next_invoice_sequence: 1,
    phone: null,
    preferred_locales: [],
    shipping: null,
    tax_exempt: 'none',
    test_clock: null,
  } as Stripe.Customer;
}

/**
 * Create a mock Stripe subscription
 */
export function mockStripeSubscription(
  params: MockStripeSubscriptionParams = {}
): Stripe.Subscription {
  const now = Math.floor(Date.now() / 1000);
  const {
    id = 'sub_test123',
    customer = 'cus_test123',
    status = 'active',
    priceId = 'price_pro',
    currentPeriodStart = now,
    currentPeriodEnd = now + 30 * 24 * 60 * 60,
    cancelAtPeriodEnd = false,
    canceledAt = null,
    trialEnd = null,
  } = params;

  return {
    id,
    object: 'subscription',
    customer,
    status,
    cancel_at_period_end: cancelAtPeriodEnd,
    canceled_at: canceledAt,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    trial_end: trialEnd,
    items: {
      object: 'list',
      data: [
        {
          id: 'si_test123',
          object: 'subscription_item',
          price: {
            id: priceId,
            object: 'price',
            active: true,
            currency: 'usd',
            product: 'prod_test',
            type: 'recurring',
            unit_amount: 1900,
            recurring: {
              interval: 'month',
              interval_count: 1,
            },
            livemode: false,
            metadata: {},
            nickname: null,
            created: now,
            billing_scheme: 'per_unit',
            lookup_key: null,
            tiers_mode: null,
            transform_quantity: null,
            unit_amount_decimal: '1900',
          },
          quantity: 1,
          subscription: id,
          created: now,
          metadata: {},
          billing_thresholds: null,
          tax_rates: [],
        },
      ],
      has_more: false,
      url: '/v1/subscription_items',
    },
    created: now,
    livemode: false,
    metadata: {},
    application: null,
    application_fee_percent: null,
    automatic_tax: { enabled: false },
    billing_cycle_anchor: currentPeriodStart,
    billing_thresholds: null,
    cancel_at: null,
    cancellation_details: null,
    collection_method: 'charge_automatically',
    currency: 'usd',
    days_until_due: null,
    default_payment_method: null,
    default_source: null,
    default_tax_rates: [],
    description: null,
    discount: null,
    ended_at: null,
    latest_invoice: null,
    next_pending_invoice_item_invoice: null,
    pause_collection: null,
    payment_settings: null,
    pending_invoice_item_interval: null,
    pending_setup_intent: null,
    pending_update: null,
    schedule: null,
    start_date: currentPeriodStart,
    test_clock: null,
    transfer_data: null,
    trial_start: null,
    trial_settings: null,
  } as Stripe.Subscription;
}

/**
 * Create a mock Stripe checkout session
 */
export function mockStripeCheckoutSession(
  params: MockStripeCheckoutSessionParams = {}
): Stripe.Checkout.Session {
  const {
    id = 'cs_test123',
    customer = 'cus_test123',
    mode = 'subscription',
    url = 'https://checkout.stripe.com/pay/cs_test123',
    metadata = {},
  } = params;

  return {
    id,
    object: 'checkout.session',
    customer,
    mode,
    url,
    metadata,
    after_expiration: null,
    allow_promotion_codes: true,
    amount_subtotal: 1900,
    amount_total: 1900,
    automatic_tax: { enabled: false, status: null },
    billing_address_collection: 'auto',
    cancel_url: 'https://example.com/cancel',
    client_reference_id: null,
    consent: null,
    consent_collection: null,
    created: Math.floor(Date.now() / 1000),
    currency: 'usd',
    custom_fields: [],
    custom_text: {
      shipping_address: null,
      submit: null,
      terms_of_service_acceptance: null,
    },
    customer_creation: null,
    customer_details: null,
    customer_email: null,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    invoice: null,
    invoice_creation: null,
    livemode: false,
    locale: null,
    payment_intent: null,
    payment_link: null,
    payment_method_collection: 'always',
    payment_method_options: null,
    payment_method_types: ['card'],
    payment_status: 'unpaid',
    phone_number_collection: { enabled: false },
    recovered_from: null,
    setup_intent: null,
    shipping_address_collection: null,
    shipping_cost: null,
    shipping_details: null,
    shipping_options: [],
    status: 'open',
    submit_type: null,
    subscription: null,
    success_url: 'https://example.com/success',
    total_details: null,
    ui_mode: 'hosted',
  } as Stripe.Checkout.Session;
}

/**
 * Create a mock Stripe billing portal session
 */
export function mockStripeBillingPortalSession(
  params: MockStripeBillingPortalSessionParams = {}
): Stripe.BillingPortal.Session {
  const {
    id = 'bps_test123',
    customer = 'cus_test123',
    url = 'https://billing.stripe.com/session/test123',
  } = params;

  return {
    id,
    object: 'billing_portal.session',
    configuration: 'bpc_test',
    created: Math.floor(Date.now() / 1000),
    customer,
    livemode: false,
    locale: null,
    on_behalf_of: null,
    return_url: 'https://example.com/account',
    url,
  } as Stripe.BillingPortal.Session;
}

/**
 * Create a mock Stripe event
 */
export function mockStripeEvent(params: MockStripeEventParams = {}): Stripe.Event {
  const {
    id = 'evt_test123',
    type = 'customer.subscription.created',
    data = { object: {} },
  } = params;

  return {
    id,
    object: 'event',
    type,
    data,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
    api_version: '2025-12-15.clover',
  } as Stripe.Event;
}

/**
 * Create a full Stripe mock with all methods
 */
export function createStripeMock() {
  const customers = {
    create: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const subscriptions = {
    create: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
    list: vi.fn(),
  };

  const checkoutSessions = {
    create: vi.fn(),
    retrieve: vi.fn(),
  };

  const billingPortalSessions = {
    create: vi.fn(),
  };

  const webhooks = {
    constructEvent: vi.fn(),
  };

  return {
    customers,
    subscriptions,
    checkout: {
      sessions: checkoutSessions,
    },
    billingPortal: {
      sessions: billingPortalSessions,
    },
    webhooks,
  };
}

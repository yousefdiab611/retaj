import Stripe from "stripe";

const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
// Pin to a recent stable API version so contract changes are explicit.
// Override via STRIPE_API_VERSION when migrating to a newer release.
const STRIPE_API_VERSION = (process.env.STRIPE_API_VERSION ?? "2024-06-20") as Stripe.LatestApiVersion;
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION }) : null;

export const isStripeConfigured = (): boolean => stripe !== null;

export type BillingPlanDefinition = {
  key: string;
  title: string;
  description: string;
  interval: "MONTHLY" | "YEARLY" | "TRIAL";
  amountCents: number;
  currency: string;
  trialDays?: number;
};

export const billingPlans: BillingPlanDefinition[] = [
  {
    key: "FREE",
    title: "Free plan",
    description: "Basic cloud access with limited licenses and reporting.",
    interval: "TRIAL",
    amountCents: 0,
    currency: "USD",
    trialDays: 14,
  },
  {
    key: "PRO",
    title: "Pro monthly",
    description: "Full SaaS access with unlimited devices and premium support.",
    interval: "MONTHLY",
    amountCents: 4999,
    currency: "USD",
  },
  {
    key: "PRO_YEARLY",
    title: "Pro yearly",
    description: "Save with annual billing and auto-renewal.",
    interval: "YEARLY",
    amountCents: 49900,
    currency: "USD",
  },
  {
    key: "ENTERPRISE",
    title: "Enterprise custom",
    description: "Custom pricing, onboarding, and dedicated support.",
    interval: "YEARLY",
    amountCents: 0,
    currency: "USD",
  },
];

export function getBillingPlan(key: string) {
  return billingPlans.find((plan) => plan.key === key) ?? null;
}

export async function createStripeCheckoutSession(options: {
  tenantId: string;
  planKey: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}) {
  if (!stripe) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
  }

  const plan = getBillingPlan(options.planKey);
  if (!plan) {
    throw new Error("Invalid billing plan");
  }

  const session = await stripe.checkout.sessions.create({
    customer_email: options.customerEmail,
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: plan.currency.toLowerCase(),
          product_data: {
            name: plan.title,
            description: plan.description,
          },
          unit_amount: plan.amountCents,
        },
        quantity: 1,
      },
    ],
    mode: plan.amountCents === 0 ? "subscription" : "payment",
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    metadata: {
      tenantId: options.tenantId,
      planKey: options.planKey,
    },
  });

  return session;
}

export function verifyStripeWebhookSignature(payload: Buffer, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    throw new Error("Stripe webhook is not configured");
  }
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

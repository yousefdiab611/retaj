import type { Request, Response } from "express";
import type Stripe from "stripe";

import { getBillingPlans, createSubscriptionDraft, recordPaymentForSubscription, activateSubscriptionForTenant, createLicenseForSubscription, getTenantSubscriptions, cancelSubscription } from "../services/subscription.service";
import { createStripeCheckoutSession, verifyStripeWebhookSignature, getBillingPlan } from "../services/payment.service";
import { prisma } from "../lib/prisma";
import { writeAuditLog } from "../services/audit.service";
import { AuditActions } from "../constants/auditActions";

export const billingController = {
  async getPlans(_req: Request, res: Response) {
    const plans = getBillingPlans();
    res.json({ plans });
  },

  async createCheckoutSession(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    if (!tenantId) {
      res.status(400).json({ error: "Tenant required", code: "TENANT_REQUIRED" });
      return;
    }

    const planKey = String(req.body.planKey ?? "PRO");
    const successUrl = String(req.body.successUrl ?? "");
    const cancelUrl = String(req.body.cancelUrl ?? "");
    const customerEmail = req.body.customerEmail ? String(req.body.customerEmail) : undefined;

    if (!successUrl || !cancelUrl) {
      res.status(400).json({ error: "Checkout URLs required", code: "VALIDATION" });
      return;
    }

    const plan = getBillingPlan(planKey);
    if (!plan) {
      res.status(400).json({ error: "Invalid plan selected", code: "VALIDATION" });
      return;
    }

    const session = await createStripeCheckoutSession({ tenantId, planKey, successUrl, cancelUrl, customerEmail });
    const draft = await createSubscriptionDraft({
      tenantId,
      planKey,
      interval: plan.interval,
      amountCents: plan.amountCents,
      currency: plan.currency,
      metadata: { checkoutSessionId: session.id },
    });

    await writeAuditLog({
      action: AuditActions.TRANSACTION_CREATE,
      tenantId,
      userId: req.userId,
      entityType: "Subscription",
      entityId: draft.id,
      metadata: { planKey, amountCents: plan.amountCents, checkoutSessionId: session.id },
    });

    res.json({ url: session.url, sessionId: session.id, subscriptionId: draft.id });
  },

  async listSubscriptions(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    if (!tenantId) {
      res.status(400).json({ error: "Tenant required", code: "TENANT_REQUIRED" });
      return;
    }
    const subscriptions = await getTenantSubscriptions(tenantId);
    res.json({ subscriptions });
  },

  async cancelSubscription(req: Request, res: Response) {
    const tenantId = req.userTenantId;
    const subscriptionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!tenantId) {
      res.status(400).json({ error: "Tenant required", code: "TENANT_REQUIRED" });
      return;
    }
    const result = await cancelSubscription(tenantId, subscriptionId ?? "");
    if (result.count === 0) {
      res.status(404).json({ error: "Subscription not found", code: "NOT_FOUND" });
      return;
    }
    res.status(204).send();
  },

  async handleStripeWebhook(req: Request, res: Response) {
    const signature = String(req.headers["stripe-signature"] ?? "");
    const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(String(req.body ?? ""), "utf8");
    if (!rawBody || !signature) {
      res.status(400).json({ error: "Missing webhook payload or signature" });
      return;
    }

    let event: Stripe.Event;
    try {
      event = verifyStripeWebhookSignature(rawBody, signature);
    } catch (err) {
      res.status(400).json({ error: "Webhook signature verification failed" });
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId as string | undefined;
      const subscriptionId = session.metadata?.checkoutSessionId as string | undefined;
      if (!tenantId || !subscriptionId) {
        res.status(400).json({ error: "Missing tenant or checkout session metadata" });
        return;
      }

      const subscription = await prisma.subscription.findFirst({
        where: { tenantId, metadata: { path: ["checkoutSessionId"], equals: subscriptionId } },
      });
      if (!subscription) {
        res.status(404).json({ error: "Subscription draft not found" });
        return;
      }

      const paymentIntent = session.payment_intent as string | undefined;
      const amountCents = Number(session.amount_total ?? subscription.amountCents);
      const receiptUrl = session.payment_intent ? undefined : undefined;

      await recordPaymentForSubscription({
        tenantId,
        subscriptionId: subscription.id,
        provider: "STRIPE",
        providerPaymentId: paymentIntent ?? session.payment_status,
        amountCents,
        currency: String(session.currency ?? subscription.currency).toUpperCase(),
        success: session.payment_status === "paid",
        description: `Checkout ${session.id}`,
        receiptUrl,
        metadata: { checkoutSessionId: session.id },
      });

      if (session.payment_status === "paid") {
        await activateSubscriptionForTenant(tenantId, subscription.id);
        const expireDate = new Date(Date.now() + (session.metadata?.planKey === "PRO_YEARLY" ? 365 : 30) * 24 * 60 * 60 * 1000);
        await createLicenseForSubscription({
          subscriptionId: subscription.id,
          tenantId,
          expiresAt: expireDate,
          trialMode: session.metadata?.planKey === "FREE",
        });
      }
    }

    res.status(200).json({ received: true });
  },
};

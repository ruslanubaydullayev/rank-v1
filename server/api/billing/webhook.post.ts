import type Stripe from "stripe";

import { syncSubscriptionFromStripe } from "~~/server/utils/billing";
import { useStripe } from "~~/server/utils/stripe";

/**
 * POST /api/billing/webhook — Stripe webhook receiver.
 * Verifies the signature, then syncs subscription lifecycle events into the DB.
 * Requires the raw request body for signature verification.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const secret = config.stripe.webhookSecret;
  if (!secret) {
    throw createError({
      statusCode: 500,
      statusMessage: "STRIPE_WEBHOOK_SECRET is not configured",
    });
  }

  const signature = getHeader(event, "stripe-signature");
  const raw = await readRawBody(event, false); // Buffer
  if (!signature || !raw) {
    throw createError({ statusCode: 400, statusMessage: "Invalid webhook" });
  }

  const stripe = useStripe();
  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    console.error("[stripe] signature verification failed:", err);
    throw createError({ statusCode: 400, statusMessage: "Bad signature" });
  }

  const toDate = (unix?: number | null) =>
    unix ? new Date(unix * 1000) : null;

  switch (stripeEvent.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = stripeEvent.data.object as Stripe.Subscription;
      const item = sub.items?.data?.[0];
      await syncSubscriptionFromStripe({
        userId: sub.metadata?.userId,
        stripeCustomerId: String(sub.customer),
        stripeSubscriptionId: sub.id,
        status:
          stripeEvent.type === "customer.subscription.deleted"
            ? "canceled"
            : sub.status,
        plan: item?.price?.nickname ?? "pro_monthly",
        currentPeriodEnd: toDate(
          // current_period_end lives on the item in recent API versions.
          (item as unknown as { current_period_end?: number })
            ?.current_period_end ??
            (sub as unknown as { current_period_end?: number })
              .current_period_end,
        ),
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = stripeEvent.data.object as Stripe.Invoice;
      if (invoice.customer) {
        await syncSubscriptionFromStripe({
          stripeCustomerId: String(invoice.customer),
          stripeSubscriptionId: null,
          status: "past_due",
          plan: null,
          currentPeriodEnd: null,
        });
      }
      break;
    }

    default:
      // Unhandled event types are acknowledged without action.
      break;
  }

  return { received: true };
});

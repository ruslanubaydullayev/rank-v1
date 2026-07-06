import { getSubscriptionRow } from "~~/server/utils/billing";
import { useStripe } from "~~/server/utils/stripe";

/**
 * GET /api/billing/portal — Stripe Customer Portal link for managing/cancelling.
 * Returns { url }.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  const config = useRuntimeConfig();

  const sub = await getSubscriptionRow(user.id);
  if (!sub?.stripeCustomerId) {
    throw createError({
      statusCode: 400,
      statusMessage: "No billing account found. Subscribe first.",
    });
  }

  const stripe = useStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${config.public.siteUrl}/account`,
  });

  return { url: session.url };
});

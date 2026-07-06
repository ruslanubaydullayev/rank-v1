import { ensureStripeCustomer } from "~~/server/utils/billing";
import { useStripe } from "~~/server/utils/stripe";

/**
 * POST /api/billing/create-checkout-session
 * Creates a Stripe Checkout session for the $9/mo plan. Returns { url }.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  const config = useRuntimeConfig();

  if (!config.stripe.priceId) {
    throw createError({
      statusCode: 500,
      statusMessage: "STRIPE_PRICE_ID is not configured",
    });
  }

  const customerId = await ensureStripeCustomer(user);
  const stripe = useStripe();
  const origin = config.public.siteUrl;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: config.stripe.priceId, quantity: 1 }],
    success_url: `${origin}/account?checkout=success`,
    cancel_url: `${origin}/pricing?checkout=cancelled`,
    allow_promotion_codes: true,
    subscription_data: { metadata: { userId: user.id } },
    client_reference_id: user.id,
  });

  return { url: session.url };
});

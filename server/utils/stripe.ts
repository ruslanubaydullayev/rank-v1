import Stripe from "stripe";

let _stripe: Stripe | null = null;

/** Lazily-initialised Stripe SDK client. */
export function useStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = useRuntimeConfig().stripe.secretKey;
  if (!key) {
    throw createError({
      statusCode: 500,
      statusMessage: "STRIPE_SECRET_KEY is not configured",
    });
  }
  // Use the SDK's pinned API version to avoid version drift.
  _stripe = new Stripe(key);
  return _stripe;
}

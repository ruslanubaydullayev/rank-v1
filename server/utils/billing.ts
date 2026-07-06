import { desc, eq } from "drizzle-orm";

import { schema, useDb } from "./db";
import { useStripe } from "./stripe";

/** Find the latest subscription row for a user (may be inactive/placeholder). */
export async function getSubscriptionRow(userId: string) {
  const db = useDb();
  const [row] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, userId))
    .orderBy(desc(schema.subscriptions.updatedAt))
    .limit(1);
  return row ?? null;
}

/** Get or create a Stripe customer for the user, persisting the id. */
export async function ensureStripeCustomer(user: {
  id: string;
  email: string;
  name: string | null;
}): Promise<string> {
  const db = useDb();
  const existing = await getSubscriptionRow(user.id);
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const stripe = useStripe();
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId: user.id },
  });

  if (existing) {
    await db
      .update(schema.subscriptions)
      .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
      .where(eq(schema.subscriptions.id, existing.id));
  } else {
    await db.insert(schema.subscriptions).values({
      userId: user.id,
      stripeCustomerId: customer.id,
      status: "inactive",
    });
  }

  return customer.id;
}

/** Upsert subscription state from a Stripe webhook event. */
export async function syncSubscriptionFromStripe(params: {
  userId?: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: string;
  plan: string | null;
  currentPeriodEnd: Date | null;
}) {
  const db = useDb();

  // Match on customer id first (stable across the subscription lifecycle).
  const [existing] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.stripeCustomerId, params.stripeCustomerId))
    .limit(1);

  const values = {
    stripeSubscriptionId: params.stripeSubscriptionId,
    status: params.status,
    plan: params.plan,
    currentPeriodEnd: params.currentPeriodEnd,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(schema.subscriptions)
      .set(values)
      .where(eq(schema.subscriptions.id, existing.id));
  } else if (params.userId) {
    await db.insert(schema.subscriptions).values({
      userId: params.userId,
      stripeCustomerId: params.stripeCustomerId,
      ...values,
    });
  }
}

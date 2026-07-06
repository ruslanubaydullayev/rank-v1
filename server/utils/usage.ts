import { and, desc, eq, gte } from "drizzle-orm";

import { schema, useDb } from "./db";

export interface UsageStatus {
  canCreate: boolean;
  isAuthenticated: boolean;
  isGuest: boolean; // anonymous / not-yet-signed-in actor
  isSubscribed: boolean;
  plan: string | null;
  limit: number | null; // null = unlimited (paid)
  used: number;
  resetAt: string | null; // ISO timestamp when the oldest counted render ages out
  reason: "ok" | "login_required" | "limit_reached";
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether the user currently has an active/trialing subscription. */
export async function getActiveSubscription(userId: string) {
  const db = useDb();
  const [sub] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, userId))
    .orderBy(desc(schema.subscriptions.updatedAt))
    .limit(1);

  if (!sub) return null;
  const active = ["active", "trialing"].includes(sub.status);
  const notExpired =
    !sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() > Date.now();
  return active && notExpired ? sub : null;
}

/**
 * Compute the current actor's render allowance.
 * Anonymous visitors (no actor yet) get their first free render without signing
 * in; a created guest is then rate-limited like a free user. Only
 * `render_completed` events in the last rolling 24h count against the limit —
 * failed/requested renders never consume the daily slot.
 */
export async function getUsageStatus(
  userId: string | null,
  isAuthenticated = false,
): Promise<UsageStatus> {
  const freeLimit = useRuntimeConfig().limits.freeRendersPer24h;

  // Fresh anonymous visitor: allow the first free video, no account required.
  if (!userId) {
    return {
      canCreate: true,
      isAuthenticated: false,
      isGuest: true,
      isSubscribed: false,
      plan: null,
      limit: freeLimit,
      used: 0,
      resetAt: null,
      reason: "ok",
    };
  }

  // Subscriptions only apply to authenticated users.
  if (isAuthenticated) {
    const sub = await getActiveSubscription(userId);
    if (sub) {
      return {
        canCreate: true,
        isAuthenticated: true,
        isGuest: false,
        isSubscribed: true,
        plan: sub.plan,
        limit: null,
        used: 0,
        resetAt: null,
        reason: "ok",
      };
    }
  }

  const db = useDb();
  const windowStart = new Date(Date.now() - DAY_MS);
  const completed = await db
    .select({ createdAt: schema.usageEvents.createdAt })
    .from(schema.usageEvents)
    .where(
      and(
        eq(schema.usageEvents.userId, userId),
        eq(schema.usageEvents.eventType, "render_completed"),
        gte(schema.usageEvents.createdAt, windowStart),
      ),
    )
    .orderBy(schema.usageEvents.createdAt);

  const used = completed.length;
  const canCreate = used < freeLimit;
  const resetAt =
    !canCreate && completed[0]
      ? new Date(completed[0].createdAt.getTime() + DAY_MS).toISOString()
      : null;

  return {
    canCreate,
    isAuthenticated,
    isGuest: !isAuthenticated,
    isSubscribed: false,
    plan: null,
    limit: freeLimit,
    used,
    resetAt,
    reason: canCreate ? "ok" : "limit_reached",
  };
}

/** Record a usage event (analytics + rate-limit enforcement). */
export async function logUsageEvent(
  userId: string,
  eventType: "render_requested" | "render_completed" | "render_failed",
  videoJobId?: string,
) {
  const db = useDb();
  await db.insert(schema.usageEvents).values({
    userId,
    eventType,
    videoJobId: videoJobId ?? null,
  });
}

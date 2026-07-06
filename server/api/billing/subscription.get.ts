import { getSubscriptionRow } from "~~/server/utils/billing";

/** GET /api/billing/subscription — current subscription summary for the user. */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  const sub = await getSubscriptionRow(user.id);

  if (!sub) {
    return {
      status: "none",
      plan: null,
      currentPeriodEnd: null,
      active: false,
    };
  }

  const active =
    ["active", "trialing"].includes(sub.status) &&
    (!sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() > Date.now());

  return {
    status: sub.status,
    plan: sub.plan,
    currentPeriodEnd: sub.currentPeriodEnd,
    active,
  };
});

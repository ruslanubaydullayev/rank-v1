import { getActor } from "~~/server/utils/actor";
import { getUsageStatus } from "~~/server/utils/usage";

/**
 * GET /api/usage/status
 * Whether the current actor can start a render now, and when their limit
 * resets. Fresh anonymous visitors can create their first video without
 * signing in; after that they're prompted to sign in.
 */
export default defineEventHandler(async (event) => {
  const { userId, isAuthenticated } = await getActor(event);
  return getUsageStatus(userId, isAuthenticated);
});

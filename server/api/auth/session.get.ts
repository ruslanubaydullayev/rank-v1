/**
 * GET /api/auth/session — current session/user info.
 * Returns { user } or { user: null } when unauthenticated.
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  return { user: session.user ?? null };
});

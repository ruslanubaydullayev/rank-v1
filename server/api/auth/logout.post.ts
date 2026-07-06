/** POST /api/auth/logout — clear the current session. */
export default defineEventHandler(async (event) => {
  await clearUserSession(event);
  return { ok: true };
});

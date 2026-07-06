/**
 * Route middleware: require an authenticated session.
 * Apply per-page via `definePageMeta({ middleware: "auth" })`.
 */
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession();
  if (!loggedIn.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
  }
});

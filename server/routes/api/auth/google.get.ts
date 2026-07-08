import { mergeGuestIntoUser } from "~~/server/utils/actor";
import { upsertUserFromGoogle } from "~~/server/utils/users";

/**
 * Google OAuth callback + initiation, handled by nuxt-auth-utils.
 * Redirect URI to register in Google console: <SITE_URL>/api/auth/google
 *
 * The API runs behind the Vercel proxy on a different host than the browser,
 * so we pin redirectURL to the public site URL. Otherwise nuxt-auth-utils would
 * derive it from the internal request host (Contabo) and Google would reject it.
 */
const siteUrl = (
  process.env.NUXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

export default defineOAuthGoogleEventHandler({
  config: {
    scope: ["openid", "email", "profile"],
    redirectURL: `${siteUrl}/api/auth/google`,
  },
  async onSuccess(event, { user: googleUser }) {
    const dbUser = await upsertUserFromGoogle({
      sub: googleUser.sub,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
    });

    // Carry over any video created as a guest before signing in.
    await mergeGuestIntoUser(event, dbUser.id);

    await setUserSession(event, {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        avatarUrl: dbUser.avatarUrl,
      },
      loggedInAt: new Date().toISOString(),
      secure: {
        googleId: dbUser.googleId,
      },
    });

    // Honor an intended destination set before login (defaults to /create).
    const redirectCookie = getCookie(event, "post_login_redirect");
    deleteCookie(event, "post_login_redirect");
    const target =
      redirectCookie && redirectCookie.startsWith("/")
        ? redirectCookie
        : "/create";
    return sendRedirect(event, target);
  },
  onError(event, error) {
    console.error("[auth] Google OAuth error:", error);
    return sendRedirect(event, "/login?error=oauth");
  },
});

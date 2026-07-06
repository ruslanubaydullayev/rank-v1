// Augments nuxt-auth-utils session types.
declare module "#auth-utils" {
  interface User {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  }

  interface UserSession {
    // Populated at login; refreshed on demand.
    loggedInAt?: string;
  }

  interface SecureSessionData {
    // Reserved for server-only session data (never sent to the client).
    googleId?: string;
  }
}

export {};

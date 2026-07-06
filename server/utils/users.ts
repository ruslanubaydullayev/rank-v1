import { eq } from "drizzle-orm";

import { schema, useDb } from "./db";

export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

/**
 * Insert or update a user from a Google OAuth profile.
 * Keyed on google_id; keeps email/name/avatar in sync on subsequent logins.
 */
export async function upsertUserFromGoogle(profile: GoogleProfile) {
  const db = useDb();
  const now = new Date();

  const [user] = await db
    .insert(schema.users)
    .values({
      googleId: profile.sub,
      email: profile.email,
      name: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
    })
    .onConflictDoUpdate({
      target: schema.users.googleId,
      set: {
        email: profile.email,
        name: profile.name ?? null,
        avatarUrl: profile.picture ?? null,
        updatedAt: now,
      },
    })
    .returning();

  return user;
}

export async function getUserById(id: string) {
  const db = useDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  return user ?? null;
}

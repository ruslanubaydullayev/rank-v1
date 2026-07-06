import { eq } from "drizzle-orm";
import type { H3Event } from "h3";

import { schema, useDb } from "./db";

const GUEST_COOKIE = "guest_id";
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface Actor {
  userId: string | null;
  isAuthenticated: boolean;
}

/**
 * Resolve the current actor without creating anything:
 *  - a signed-in user (from the session), or
 *  - an existing guest (from the guest_id cookie), or
 *  - null (a fresh anonymous visitor).
 */
export async function getActor(event: H3Event): Promise<Actor> {
  const session = await getUserSession(event);
  if (session.user?.id) {
    return { userId: session.user.id, isAuthenticated: true };
  }

  const guestId = getCookie(event, GUEST_COOKIE);
  if (guestId) {
    const db = useDb();
    const [guest] = await db
      .select({ id: schema.users.id, isGuest: schema.users.isGuest })
      .from(schema.users)
      .where(eq(schema.users.id, guestId))
      .limit(1);
    if (guest?.isGuest) {
      return { userId: guest.id, isAuthenticated: false };
    }
  }

  return { userId: null, isAuthenticated: false };
}

/**
 * Resolve the actor, creating a guest user (and cookie) if none exists yet.
 * Use on write actions (import/upload/render) so anonymous visitors can make
 * their first video without signing in.
 */
export async function requireActor(event: H3Event): Promise<Actor> {
  const actor = await getActor(event);
  if (actor.userId) return actor;

  const db = useDb();
  const [guest] = await db
    .insert(schema.users)
    .values({ isGuest: true })
    .returning({ id: schema.users.id });

  setCookie(event, GUEST_COOKIE, guest.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });

  return { userId: guest.id, isAuthenticated: false };
}

/** Resolve an existing actor's id or throw 401 (for status/download reads). */
export async function requireActorUserId(event: H3Event): Promise<string> {
  const { userId } = await getActor(event);
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Not authorized" });
  }
  return userId;
}

/**
 * Merge a guest's content into a real user on sign-in, then remove the guest.
 * Keeps the just-created video + its usage tied to the authenticated account.
 */
export async function mergeGuestIntoUser(
  event: H3Event,
  userId: string,
): Promise<void> {
  const guestId = getCookie(event, GUEST_COOKIE);
  deleteCookie(event, GUEST_COOKIE);
  if (!guestId || guestId === userId) return;

  const db = useDb();
  await db.transaction(async (tx) => {
    const [guest] = await tx
      .select({ id: schema.users.id, isGuest: schema.users.isGuest })
      .from(schema.users)
      .where(eq(schema.users.id, guestId))
      .limit(1);
    if (!guest?.isGuest) return;

    await tx
      .update(schema.videoJobs)
      .set({ userId })
      .where(eq(schema.videoJobs.userId, guestId));
    await tx
      .update(schema.stagedClips)
      .set({ userId })
      .where(eq(schema.stagedClips.userId, guestId));
    await tx
      .update(schema.usageEvents)
      .set({ userId })
      .where(eq(schema.usageEvents.userId, guestId));

    await tx.delete(schema.users).where(eq(schema.users.id, guestId));
  });
}

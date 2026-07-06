import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Database schema for Ranking Shorts.
 * Mirrors the MVP spec: users, subscriptions, video_jobs, clip_items, usage_events.
 */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable for guest (anonymous) users, who have no Google identity yet.
    // Postgres allows multiple NULLs under a UNIQUE constraint.
    googleId: text("google_id").unique(),
    email: text("email").unique(),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    // True for anonymous "first free video" users, keyed off a guest cookie.
    isGuest: boolean("is_guest").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("users_email_idx").on(t.email)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    // active / past_due / canceled / trialing ...
    status: text("status").notNull().default("inactive"),
    plan: text("plan"), // e.g. "pro_monthly"
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("subscriptions_user_id_idx").on(t.userId)],
);

export const videoJobs = pgTable(
  "video_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // queued / processing / done / failed
    status: text("status").notNull().default("queued"),
    outputUrl: text("output_url"), // storage key once done
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("video_jobs_user_id_created_at_idx").on(t.userId, t.createdAt)],
);

export const clipItems = pgTable(
  "clip_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoJobId: uuid("video_job_id")
      .notNull()
      .references(() => videoJobs.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    label: text("label").notNull(),
    // "link" | "upload"
    sourceType: text("source_type").notNull(),
    // "instagram" | "tiktok" | null (uploads)
    platform: text("platform"),
    sourceUrl: text("source_url"),
    storageKey: text("storage_key").notNull(),
    durationSeconds: numeric("duration_seconds"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("clip_items_job_order_idx").on(t.videoJobId, t.orderIndex)],
);

/**
 * Staging area for clips uploaded/imported before a render job is created.
 * The two-phase API (import/upload → render) needs somewhere to hold a clip
 * reference; at render time these are copied into `clip_items` (per the spec)
 * and can be cleaned up. Not part of the original spec schema, but required to
 * support returning a `clipId` prior to job creation.
 */
export const stagedClips = pgTable(
  "staged_clips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(), // "link" | "upload"
    platform: text("platform"), // "instagram" | "tiktok" | null
    sourceUrl: text("source_url"),
    storageKey: text("storage_key").notNull(),
    durationSeconds: numeric("duration_seconds"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("staged_clips_user_idx").on(t.userId, t.createdAt)],
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    videoJobId: uuid("video_job_id").references(() => videoJobs.id, {
      onDelete: "set null",
    }),
    // "render_requested" | "render_completed" | "render_failed"
    eventType: text("event_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("usage_events_user_created_idx").on(t.userId, t.createdAt)],
);

// --- Relations (for typed joins) ---
export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
  videoJobs: many(videoJobs),
  usageEvents: many(usageEvents),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const videoJobsRelations = relations(videoJobs, ({ one, many }) => ({
  user: one(users, {
    fields: [videoJobs.userId],
    references: [users.id],
  }),
  clipItems: many(clipItems),
}));

export const clipItemsRelations = relations(clipItems, ({ one }) => ({
  videoJob: one(videoJobs, {
    fields: [clipItems.videoJobId],
    references: [videoJobs.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type VideoJob = typeof videoJobs.$inferSelect;
export type ClipItem = typeof clipItems.$inferSelect;
export type UsageEvent = typeof usageEvents.$inferSelect;
export type StagedClip = typeof stagedClips.$inferSelect;

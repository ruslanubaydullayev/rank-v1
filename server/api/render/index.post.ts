import { and, eq, inArray } from "drizzle-orm";

import { requireActor } from "~~/server/utils/actor";
import { schema, useDb } from "~~/server/utils/db";
import { enqueueRender } from "~~/server/utils/render-queue";
import { logUsageEvent, getUsageStatus } from "~~/server/utils/usage";
import { renderSchema } from "~~/server/utils/validation";

/**
 * POST /api/render
 * Body: { title, items: [{ clipId, label, order }] }
 * Creates a video job from staged clips and queues it. Returns { jobId }.
 *
 * The daily limit is RE-CHECKED here server-side — never trust the client.
 */
export default defineEventHandler(async (event) => {
  const { userId, isAuthenticated } = await requireActor(event);
  const body = await readValidatedBody(event, renderSchema.parse);

  // Server-side limit gate (see spec §5 / §6). Guests get one free render.
  const usage = await getUsageStatus(userId, isAuthenticated);
  if (!usage.canCreate) {
    throw createError({
      statusCode: 403,
      statusMessage: usage.isAuthenticated
        ? "Daily render limit reached. Upgrade or try again later."
        : "You’ve used your free video. Sign in to make more.",
      data: {
        reason: usage.reason,
        resetAt: usage.resetAt,
        isAuthenticated: usage.isAuthenticated,
      },
    });
  }

  const db = useDb();

  // Verify every referenced clip belongs to this actor.
  const clipIds = body.items.map((i) => i.clipId);
  const staged = await db
    .select()
    .from(schema.stagedClips)
    .where(
      and(
        eq(schema.stagedClips.userId, userId),
        inArray(schema.stagedClips.id, clipIds),
      ),
    );

  const byId = new Map(staged.map((c) => [c.id, c]));
  if (byId.size !== clipIds.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "One or more clips are missing or no longer available.",
    });
  }

  // Create the job + ordered clip_items in a transaction.
  const ordered = [...body.items].sort((a, b) => a.order - b.order);

  const jobId = await db.transaction(async (tx) => {
    const [job] = await tx
      .insert(schema.videoJobs)
      .values({ userId, title: body.title, status: "queued" })
      .returning({ id: schema.videoJobs.id });

    await tx.insert(schema.clipItems).values(
      ordered.map((item, idx) => {
        const clip = byId.get(item.clipId)!;
        return {
          videoJobId: job.id,
          orderIndex: idx + 1, // 1-based rank
          label: item.label,
          sourceType: clip.sourceType,
          platform: clip.platform,
          sourceUrl: clip.sourceUrl,
          storageKey: clip.storageKey,
          durationSeconds: clip.durationSeconds,
        };
      }),
    );

    return job.id;
  });

  await logUsageEvent(userId, "render_requested", jobId);
  enqueueRender(jobId);

  return { jobId };
});

import { and, eq } from "drizzle-orm";

import { requireActorUserId } from "~~/server/utils/actor";
import { schema, useDb } from "~~/server/utils/db";
import { useStorage } from "~~/server/utils/storage";

/**
 * GET /api/render/:jobId/download — returns a signed URL to the finished .mp4.
 * Ownership is enforced; only "done" jobs are downloadable.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireActorUserId(event);
  const jobId = getRouterParam(event, "jobId");
  if (!jobId) {
    throw createError({ statusCode: 400, statusMessage: "Missing jobId" });
  }

  const db = useDb();
  const [job] = await db
    .select()
    .from(schema.videoJobs)
    .where(
      and(eq(schema.videoJobs.id, jobId), eq(schema.videoJobs.userId, userId)),
    )
    .limit(1);

  if (!job) {
    throw createError({ statusCode: 404, statusMessage: "Job not found" });
  }
  if (job.status !== "done" || !job.outputUrl) {
    throw createError({ statusCode: 409, statusMessage: "Render not ready" });
  }

  const url = await useStorage().getSignedDownloadUrl(job.outputUrl, 3600);
  return { url };
});

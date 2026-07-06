import { and, eq } from "drizzle-orm";

import { requireActorUserId } from "~~/server/utils/actor";
import { schema, useDb } from "~~/server/utils/db";

/** GET /api/render/:jobId/status — poll render job status. */
export default defineEventHandler(async (event) => {
  const userId = await requireActorUserId(event);
  const jobId = getRouterParam(event, "jobId");
  if (!jobId) {
    throw createError({ statusCode: 400, statusMessage: "Missing jobId" });
  }

  const db = useDb();
  const [job] = await db
    .select({
      id: schema.videoJobs.id,
      status: schema.videoJobs.status,
      errorMessage: schema.videoJobs.errorMessage,
      createdAt: schema.videoJobs.createdAt,
      completedAt: schema.videoJobs.completedAt,
    })
    .from(schema.videoJobs)
    .where(
      and(eq(schema.videoJobs.id, jobId), eq(schema.videoJobs.userId, userId)),
    )
    .limit(1);

  if (!job) {
    throw createError({ statusCode: 404, statusMessage: "Job not found" });
  }

  return {
    jobId: job.id,
    status: job.status as "queued" | "processing" | "done" | "failed",
    error: job.errorMessage,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  };
});

import { desc, eq } from "drizzle-orm";

import { schema, useDb } from "~~/server/utils/db";

/** GET /api/videos — the current user's recent render jobs (history). */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  const db = useDb();

  const jobs = await db
    .select({
      id: schema.videoJobs.id,
      title: schema.videoJobs.title,
      status: schema.videoJobs.status,
      createdAt: schema.videoJobs.createdAt,
      completedAt: schema.videoJobs.completedAt,
    })
    .from(schema.videoJobs)
    .where(eq(schema.videoJobs.userId, user.id))
    .orderBy(desc(schema.videoJobs.createdAt))
    .limit(50);

  return { jobs };
});

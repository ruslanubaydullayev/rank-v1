import { and, eq } from "drizzle-orm";
import { createReadStream } from "node:fs";

import { requireActorUserId } from "~~/server/utils/actor";
import { schema, useDb } from "~~/server/utils/db";
import { fileExists } from "~~/server/utils/media";
import { useStorage } from "~~/server/utils/storage";

/**
 * GET /api/render/download-key?key=... — streams a local-driver file.
 * Only used when STORAGE_DRIVER=local (S3 uses real presigned URLs instead).
 *
 * Ownership is verified via the database (not the key path), so it stays
 * correct even after a guest's content is migrated to their account on login.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireActorUserId(event);
  const key = getQuery(event).key as string | undefined;
  if (!key) {
    throw createError({ statusCode: 400, statusMessage: "Missing key" });
  }

  const db = useDb();
  const [owned] = await db
    .select({ id: schema.videoJobs.id })
    .from(schema.videoJobs)
    .where(
      and(
        eq(schema.videoJobs.outputUrl, key),
        eq(schema.videoJobs.userId, userId),
      ),
    )
    .limit(1);

  if (!owned) {
    const [stagedOwned] = await db
      .select({ id: schema.stagedClips.id })
      .from(schema.stagedClips)
      .where(
        and(
          eq(schema.stagedClips.storageKey, key),
          eq(schema.stagedClips.userId, userId),
        ),
      )
      .limit(1);
    if (!stagedOwned) {
      throw createError({ statusCode: 403, statusMessage: "Forbidden" });
    }
  }

  const storage = useStorage();
  const path = storage.localFilePath(key);
  if (!path || !(await fileExists(path))) {
    throw createError({ statusCode: 404, statusMessage: "File not found" });
  }

  setHeader(event, "Content-Type", "video/mp4");
  setHeader(
    event,
    "Content-Disposition",
    `attachment; filename="ranking-short.mp4"`,
  );
  return sendStream(event, createReadStream(path));
});

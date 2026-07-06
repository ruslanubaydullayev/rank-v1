import { and, eq, isNotNull, lt } from "drizzle-orm";

import { schema, useDb } from "~~/server/utils/db";
import { useStorage } from "~~/server/utils/storage";

/**
 * Storage retention cleanup (spec §8).
 *  - Source clips: deleted ~24h after their render job completes (transient).
 *  - Staged clips: deleted ~24h after upload/import (never rendered → orphaned).
 *  - Rendered outputs: deleted ~30 days after completion.
 *
 * Idempotent + best-effort: storage.remove() is safe to call repeatedly.
 * Scheduled hourly via nitro.scheduledTasks; can also be run manually.
 */
export default defineTask({
  meta: {
    name: "storage:cleanup",
    description: "Enforce storage retention policy",
  },
  async run() {
    const db = useDb();
    const storage = useStorage();
    const now = Date.now();
    const H = 60 * 60 * 1000;
    const sourceCutoff = new Date(now - 24 * H);
    const outputCutoff = new Date(now - 30 * 24 * H);

    let sourcesDeleted = 0;
    let outputsDeleted = 0;

    // 1. Source clips for jobs that completed > 24h ago.
    const completedJobs = await db
      .select({
        id: schema.videoJobs.id,
        completedAt: schema.videoJobs.completedAt,
      })
      .from(schema.videoJobs)
      .where(
        and(
          isNotNull(schema.videoJobs.completedAt),
          lt(schema.videoJobs.completedAt, sourceCutoff),
        ),
      );

    for (const job of completedJobs) {
      const clips = await db
        .select({ storageKey: schema.clipItems.storageKey })
        .from(schema.clipItems)
        .where(eq(schema.clipItems.videoJobId, job.id));
      for (const c of clips) {
        if (c.storageKey.startsWith("sources/")) {
          await storage.remove(c.storageKey).catch(() => {});
          sourcesDeleted++;
        }
      }
    }

    // 2. Orphaned staged clips older than 24h.
    const staleStaged = await db
      .select()
      .from(schema.stagedClips)
      .where(lt(schema.stagedClips.createdAt, sourceCutoff));
    for (const s of staleStaged) {
      await storage.remove(s.storageKey).catch(() => {});
      await db
        .delete(schema.stagedClips)
        .where(eq(schema.stagedClips.id, s.id))
        .catch(() => {});
    }

    // 3. Rendered outputs older than 30 days.
    const oldOutputs = await db
      .select({
        id: schema.videoJobs.id,
        outputUrl: schema.videoJobs.outputUrl,
      })
      .from(schema.videoJobs)
      .where(
        and(
          isNotNull(schema.videoJobs.outputUrl),
          lt(schema.videoJobs.completedAt, outputCutoff),
        ),
      );
    for (const job of oldOutputs) {
      if (job.outputUrl) {
        await storage.remove(job.outputUrl).catch(() => {});
        outputsDeleted++;
      }
    }

    return { result: { sourcesDeleted, outputsDeleted } };
  },
});

import { asc, eq } from "drizzle-orm";
import { join } from "node:path";

import { schema, useDb } from "./db";
import { renderRankingVideo, makeWorkDir } from "./render";
import { useStorage } from "./storage";
import { logUsageEvent } from "./usage";

/**
 * Minimal in-process render queue for the MVP.
 * Jobs run sequentially in the background so the API responds immediately with
 * a jobId. For higher throughput, swap this for BullMQ/Redis without changing
 * the API surface — enqueueRender() is the only integration point.
 */

const pending: string[] = [];
let running = false;

export function enqueueRender(jobId: string) {
  pending.push(jobId);
  void drain();
}

async function drain() {
  if (running) return;
  running = true;
  try {
    while (pending.length) {
      const jobId = pending.shift()!;
      await processJob(jobId).catch((err) =>
        console.error(`[render] job ${jobId} crashed:`, err),
      );
    }
  } finally {
    running = false;
  }
}

async function processJob(jobId: string) {
  const db = useDb();
  const storage = useStorage();

  const [job] = await db
    .select()
    .from(schema.videoJobs)
    .where(eq(schema.videoJobs.id, jobId))
    .limit(1);
  if (!job) return;

  await db
    .update(schema.videoJobs)
    .set({ status: "processing" })
    .where(eq(schema.videoJobs.id, jobId));

  const items = await db
    .select()
    .from(schema.clipItems)
    .where(eq(schema.clipItems.videoJobId, jobId))
    .orderBy(asc(schema.clipItems.orderIndex));

  const { dir, cleanup } = await makeWorkDir();
  try {
    const clips = [];
    for (const [i, item] of items.entries()) {
      const localSrc = await storage.downloadToTemp(item.storageKey, ".mp4");
      clips.push({
        filePath: localSrc,
        label: item.label,
        rank: item.orderIndex,
      });
      void i;
    }

    const outPath = join(dir, `${jobId}.mp4`);
    await renderRankingVideo({ title: job.title, clips, outPath });

    const outputKey = `outputs/${job.userId}/${jobId}.mp4`;
    await storage.uploadFromFile(outputKey, outPath, "video/mp4");

    await db
      .update(schema.videoJobs)
      .set({
        status: "done",
        outputUrl: outputKey,
        completedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(schema.videoJobs.id, jobId));

    // Only successful renders count against the daily limit.
    await logUsageEvent(job.userId, "render_completed", jobId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Render failed unexpectedly";
    await db
      .update(schema.videoJobs)
      .set({
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
      })
      .where(eq(schema.videoJobs.id, jobId));

    // Failed renders do NOT consume the user's daily slot — they can retry now.
    await logUsageEvent(job.userId, "render_failed", jobId);
  } finally {
    await cleanup();
  }
}

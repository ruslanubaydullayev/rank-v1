import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { requireActor } from "~~/server/utils/actor";
import { schema, useDb } from "~~/server/utils/db";
import {
  downloadWithYtDlp,
  fileExists,
  probeDurationSeconds,
} from "~~/server/utils/media";
import { useStorage } from "~~/server/utils/storage";
import {
  detectPlatform,
  importClipSchema,
  isImportableInstagramUrl,
} from "~~/server/utils/validation";

/**
 * POST /api/clips/import
 * Body: { url, platform? } — download a social clip via yt-dlp, store it,
 * return a staged clip reference id.
 */
export default defineEventHandler(async (event) => {
  const { userId } = await requireActor(event);
  const body = await readValidatedBody(event, importClipSchema.parse);

  const platform = body.platform ?? detectPlatform(body.url);
  if (!platform) {
    throw createError({
      statusCode: 422,
      statusMessage: "Only Instagram and TikTok links are supported.",
    });
  }

  if (platform === "instagram" && !isImportableInstagramUrl(body.url)) {
    throw createError({
      statusCode: 422,
      statusMessage:
        "Paste a link to a specific Reel or post (e.g. instagram.com/reel/...), not a profile or homepage.",
    });
  }

  const config = useRuntimeConfig();
  const maxDuration = config.public.maxClipDurationSeconds;

  // Data logging (Section 5): who imported what, and when.
  console.info(
    JSON.stringify({
      evt: "clip_import",
      userId,
      url: body.url,
      platform,
      at: new Date().toISOString(),
    }),
  );

  const tmpOut = join(tmpdir(), `rs-src-${randomUUID()}.mp4`);
  try {
    await downloadWithYtDlp(body.url, tmpOut);

    if (!(await fileExists(tmpOut))) {
      throw createError({
        statusCode: 422,
        statusMessage: "Couldn't fetch a video from this link.",
      });
    }

    const duration = await probeDurationSeconds(tmpOut);
    if (duration && duration > maxDuration) {
      throw createError({
        statusCode: 422,
        statusMessage: `Clip is too long (max ${maxDuration}s).`,
      });
    }

    const storage = useStorage();
    const key = `sources/${userId}/${randomUUID()}.mp4`;
    await storage.putBuffer(key, await readFile(tmpOut), "video/mp4");

    const db = useDb();
    const [clip] = await db
      .insert(schema.stagedClips)
      .values({
        userId,
        sourceType: "link",
        platform,
        sourceUrl: body.url,
        storageKey: key,
        durationSeconds: duration != null ? String(duration) : null,
      })
      .returning();

    return {
      clipId: clip.id,
      platform,
      durationSeconds: duration,
      sourceType: "link" as const,
    };
  } finally {
    await rm(tmpOut, { force: true });
  }
});

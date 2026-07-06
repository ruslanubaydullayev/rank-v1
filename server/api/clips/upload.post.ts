import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { requireActor } from "~~/server/utils/actor";
import { schema, useDb } from "~~/server/utils/db";
import { fileExists, probeDurationSeconds } from "~~/server/utils/media";
import { useStorage } from "~~/server/utils/storage";

const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
]);

/**
 * POST /api/clips/upload — multipart file upload from the user's device.
 * Returns a staged clip reference id.
 */
export default defineEventHandler(async (event) => {
  const { userId } = await requireActor(event);
  const config = useRuntimeConfig();
  const maxBytes = config.public.maxUploadMb * 1024 * 1024;
  const maxDuration = config.public.maxClipDurationSeconds;

  const form = await readMultipartFormData(event);
  const file = form?.find((p) => p.name === "file" && p.filename);
  if (!file || !file.data?.length) {
    throw createError({ statusCode: 400, statusMessage: "No file uploaded." });
  }

  if (file.data.length > maxBytes) {
    throw createError({
      statusCode: 413,
      statusMessage: `File too large (max ${config.public.maxUploadMb}MB).`,
    });
  }

  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    throw createError({
      statusCode: 415,
      statusMessage: "Unsupported file type. Upload an MP4, MOV, WebM or MKV.",
    });
  }

  // Probe duration from a temp copy.
  const tmp = join(tmpdir(), `rs-upl-${randomUUID()}.mp4`);
  try {
    await writeFile(tmp, file.data);
    if (!(await fileExists(tmp))) {
      throw createError({ statusCode: 400, statusMessage: "Upload failed." });
    }

    const duration = await probeDurationSeconds(tmp);
    if (duration && duration > maxDuration) {
      throw createError({
        statusCode: 422,
        statusMessage: `Clip is too long (max ${maxDuration}s).`,
      });
    }

    const storage = useStorage();
    const key = `sources/${userId}/${randomUUID()}.mp4`;
    await storage.putBuffer(key, file.data, file.type || "video/mp4");

    const db = useDb();
    const [clip] = await db
      .insert(schema.stagedClips)
      .values({
        userId,
        sourceType: "upload",
        platform: null,
        sourceUrl: null,
        storageKey: key,
        durationSeconds: duration != null ? String(duration) : null,
      })
      .returning();

    return {
      clipId: clip.id,
      durationSeconds: duration,
      filename: file.filename,
      sourceType: "upload" as const,
    };
  } finally {
    await rm(tmp, { force: true });
  }
});

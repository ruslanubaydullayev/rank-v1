import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Storage abstraction with two drivers:
 *  - "local": files on disk (dev). Signed URLs resolve to /api/render/:id/download.
 *  - "s3":    any S3-compatible bucket (prod). Signed URLs are real presigned URLs.
 *
 * The render pipeline needs local file paths for ffmpeg/yt-dlp, so both drivers
 * expose `downloadToTemp` / `uploadFromFile` helpers.
 */

type StorageConfig = ReturnType<typeof useRuntimeConfig>["storage"];

let _s3: S3Client | null = null;

function s3Client(cfg: StorageConfig): S3Client {
  if (_s3) return _s3;
  _s3 = new S3Client({
    region: cfg.region || "auto",
    endpoint: cfg.endpoint || undefined,
    forcePathStyle: Boolean(cfg.endpoint), // needed for most S3-compatible providers
    credentials:
      cfg.accessKeyId && cfg.secretAccessKey
        ? {
            accessKeyId: cfg.accessKeyId,
            secretAccessKey: cfg.secretAccessKey,
          }
        : undefined,
  });
  return _s3;
}

function localPath(cfg: StorageConfig, key: string): string {
  // Confine everything under the configured local dir; strip leading slashes.
  const base = resolve(process.cwd(), cfg.localDir);
  const safeKey = key.replace(/^\/+/, "").replace(/\.\.(\/|\\)/g, "");
  return join(base, safeKey);
}

export function useStorage() {
  const cfg = useRuntimeConfig().storage;
  const isS3 = cfg.driver === "s3";

  async function putBuffer(key: string, data: Buffer, contentType?: string) {
    if (isS3) {
      await s3Client(cfg).send(
        new PutObjectCommand({
          Bucket: cfg.bucket,
          Key: key,
          Body: data,
          ContentType: contentType,
        }),
      );
    } else {
      const path = localPath(cfg, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, data);
    }
    return key;
  }

  async function uploadFromFile(
    key: string,
    filePath: string,
    contentType?: string,
  ) {
    if (isS3) {
      await s3Client(cfg).send(
        new PutObjectCommand({
          Bucket: cfg.bucket,
          Key: key,
          Body: createReadStream(filePath),
          ContentType: contentType,
        }),
      );
    } else {
      const dest = localPath(cfg, key);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, await readFile(filePath));
    }
    return key;
  }

  /** Materialise an object to a local temp file for ffmpeg/yt-dlp to read. */
  async function downloadToTemp(key: string, ext = ""): Promise<string> {
    const tmp = join(
      tmpdir(),
      `rs-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`,
    );
    if (isS3) {
      const res = await s3Client(cfg).send(
        new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
      );
      const bytes = await res.Body!.transformToByteArray();
      await writeFile(tmp, Buffer.from(bytes));
    } else {
      await writeFile(tmp, await readFile(localPath(cfg, key)));
    }
    return tmp;
  }

  /** Absolute path for local driver (used to stream downloads); null for s3. */
  function localFilePath(key: string): string | null {
    return isS3 ? null : localPath(cfg, key);
  }

  async function getSignedDownloadUrl(
    key: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    if (isS3) {
      return getSignedUrl(
        s3Client(cfg),
        new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
        { expiresIn: expiresInSeconds },
      );
    }
    // Local driver: served through an authenticated app route.
    return `/api/render/download-key?key=${encodeURIComponent(key)}`;
  }

  async function remove(key: string) {
    if (isS3) {
      await s3Client(cfg).send(
        new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }),
      );
    } else {
      await rm(localPath(cfg, key), { force: true });
    }
  }

  return {
    driver: cfg.driver,
    putBuffer,
    uploadFromFile,
    downloadToTemp,
    localFilePath,
    getSignedDownloadUrl,
    remove,
  };
}

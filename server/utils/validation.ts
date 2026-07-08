import { z } from "zod";

// Host allow-lists for social imports.
const INSTAGRAM_HOSTS = /(^|\.)instagram\.com$/i;
const TIKTOK_HOSTS = /(^|\.)(tiktok\.com|vm\.tiktok\.com)$/i;

export function detectPlatform(rawUrl: string): "instagram" | "tiktok" | null {
  try {
    const u = new URL(rawUrl);
    if (INSTAGRAM_HOSTS.test(u.hostname)) return "instagram";
    if (TIKTOK_HOSTS.test(u.hostname)) return "tiktok";
    return null;
  } catch {
    return null;
  }
}

// Instagram single-media paths: /p/<id>, /reel(s)/<id>, /tv/<id>, optionally
// namespaced under a username (e.g. /<user>/reel/<id>).
const IG_MEDIA_PATH = /\/(p|reel|reels|tv)\/[^/]+/i;

/**
 * Returns true when an Instagram URL points at a specific post/reel we can
 * download, false when it's a profile/homepage/other page with no single video.
 */
export function isImportableInstagramUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (!INSTAGRAM_HOSTS.test(u.hostname)) return true; // not our concern here
    return IG_MEDIA_PATH.test(u.pathname);
  } catch {
    return false;
  }
}

export const importClipSchema = z.object({
  url: z.string().url("Enter a valid URL"),
  platform: z.enum(["instagram", "tiktok"]).optional(),
});

// Character limits (kept in sync with the client inputs).
export const TITLE_MAX = 40;
export const LABEL_MAX = 30;

export const renderSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(TITLE_MAX),
  items: z
    .array(
      z.object({
        clipId: z.string().uuid(),
        label: z
          .string()
          .trim()
          .min(1, "Each clip needs a label")
          .max(LABEL_MAX),
        order: z.number().int().min(0),
      }),
    )
    .min(2, "Add at least 2 clips to rank")
    .max(50),
});

export type RenderPayload = z.infer<typeof renderSchema>;

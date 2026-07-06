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

export const importClipSchema = z.object({
  url: z.string().url("Enter a valid URL"),
  platform: z.enum(["instagram", "tiktok"]).optional(),
});

export const renderSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  items: z
    .array(
      z.object({
        clipId: z.string().uuid(),
        label: z.string().trim().min(1, "Each clip needs a label").max(80),
        order: z.number().int().min(0),
      }),
    )
    .min(2, "Add at least 2 clips to rank")
    .max(50),
});

export type RenderPayload = z.infer<typeof renderSchema>;

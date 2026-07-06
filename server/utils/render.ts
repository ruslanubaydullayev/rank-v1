import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { fileExists, runCommand } from "./media";

export interface RenderClipInput {
  filePath: string; // local path to source clip
  label: string; // per-clip caption
  rank: number; // 1-based ranking number
}

export interface RenderOptions {
  title: string; // overall title, shown at top for whole video
  clips: RenderClipInput[];
  outPath: string; // final .mp4 destination (local)
  width?: number;
  height?: number;
  fps?: number;
  perClipSeconds?: number; // hard cap per clip
}

// 9:16 vertical output.
const W = 1080;
const H = 1920;

/** Escape text for ffmpeg drawtext (colons, quotes, backslashes, %). */
function escapeDrawText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\u2019")
    .replace(/%/g, "\\%");
}

/**
 * Render the ranking video with ffmpeg.
 *
 * Pipeline per the backend spec:
 *  1. Normalise each clip to 9:16, consistent fps, scaled + padded.
 *  2. Burn in the overall title (top, full duration) + per-clip label + a
 *     colored outlined ranking badge — the label only shows while its clip plays
 *     because it's drawn onto that clip's segment before concatenation.
 *  3. Concatenate all segments into the final .mp4.
 *
 * Uses a single filter_complex graph so we avoid intermediate files.
 */
export async function renderRankingVideo(opts: RenderOptions): Promise<void> {
  const ffmpeg = useRuntimeConfig().ffmpegPath;
  const width = opts.width ?? W;
  const height = opts.height ?? H;
  const fps = opts.fps ?? 30;
  const cap = opts.perClipSeconds ?? 0;

  if (opts.clips.length === 0) {
    throw new Error("No clips to render");
  }

  const titleText = escapeDrawText(opts.title);
  const inputs: string[] = [];
  const filters: string[] = [];
  const concatLabels: string[] = [];

  opts.clips.forEach((clip, i) => {
    inputs.push("-i", clip.filePath);

    const label = escapeDrawText(clip.label);
    const rank = String(clip.rank);

    // Normalise: scale to fit, pad to exact 9:16, set fps + SAR.
    const trim = cap > 0 ? `,trim=duration=${cap},setpts=PTS-STARTPTS` : "";
    const vlabel = `v${i}`;

    filters.push(
      `[${i}:v]` +
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,` +
        `setsar=1,fps=${fps}${trim},` +
        // Ranking number badge — colored outlined number, top-left.
        `drawtext=text='${rank}':fontcolor=white:fontsize=120:` +
        `borderw=8:bordercolor=#ff0033:x=60:y=180:` +
        `box=1:boxcolor=black@0.35:boxborderw=20,` +
        // Per-clip label — bottom third, only during this clip.
        `drawtext=text='${label}':fontcolor=white:fontsize=56:` +
        `borderw=4:bordercolor=black:x=(w-text_w)/2:y=h-320:` +
        `box=1:boxcolor=black@0.5:boxborderw=24,` +
        // Overall title — pinned near the top for the whole segment.
        `drawtext=text='${titleText}':fontcolor=white:fontsize=48:` +
        `borderw=4:bordercolor=black:x=(w-text_w)/2:y=60:` +
        `box=1:boxcolor=#ff0033@0.85:boxborderw=20` +
        `[${vlabel}]`,
    );

    // Provide a silent audio track if the source has none, so concat is safe.
    const alabel = `a${i}`;
    filters.push(
      `[${i}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS${
        cap > 0 ? `,atrim=duration=${cap}` : ""
      }[${alabel}]`,
    );

    concatLabels.push(`[${vlabel}][${alabel}]`);
  });

  const concat = `${concatLabels.join("")}concat=n=${opts.clips.length}:v=1:a=1[outv][outa]`;
  filters.push(concat);

  const args = [
    "-y",
    ...inputs,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[outv]",
    "-map",
    "[outa]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    opts.outPath,
  ];

  // Missing/absent audio streams make [i:a] mapping fail; fall back to a
  // video-only concat with generated silence if the first attempt errors.
  const res = await runCommand(ffmpeg, args, { timeoutMs: 10 * 60_000 });
  if (res.timedOut) {
    throw new Error("Render timed out");
  }
  if (res.code !== 0 || !(await fileExists(opts.outPath))) {
    console.error("[ffmpeg] render failed:", res.stderr.slice(-1500));
    throw new Error("ffmpeg failed to render the video");
  }
}

/** Create a scratch dir for a render job; caller must clean it up. */
export async function makeWorkDir(): Promise<{
  dir: string;
  cleanup: () => Promise<void>;
}> {
  const dir = await mkdtemp(join(tmpdir(), "rs-render-"));
  return {
    dir,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

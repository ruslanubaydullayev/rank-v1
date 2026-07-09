import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  fileExists,
  hasAudioStream,
  probeDurationSeconds,
  runCommand,
} from "./media";

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

// A heavy/bold font is required for the "ranking video" look; ffmpeg drawtext
// can't fake weight, so we point it at a real bold font file. Override with
// RENDER_FONT_FILE (e.g. a bundled font in production/Docker).
const FONT_CANDIDATES = [
  process.env.RENDER_FONT_FILE,
  "/System/Library/Fonts/Supplemental/Arial Black.ttf",
  "/System/Library/Fonts/Supplemental/Impact.ttf",
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "/System/Library/Fonts/HelveticaNeue.ttc",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
];
let _fontFile: string | null | undefined;
function resolveFontFile(): string | null {
  if (_fontFile === undefined) {
    _fontFile =
      FONT_CANDIDATES.find((f): f is string => !!f && existsSync(f)) ?? null;
  }
  return _fontFile;
}

// Vibrant per-rank colors (ffmpeg 0xRRGGBB). Ordered to look lively/"random"
// rather than a plain rainbow. Wraps around for >10 clips.
const PALETTE = [
  "0xffe14d", // yellow
  "0xff3b5c", // red
  "0x37d5ff", // cyan
  "0x6cff59", // lime
  "0xff8a1f", // orange
  "0xb98dff", // purple
  "0xffffff", // white
  "0xff4fd8", // magenta
  "0x59b0ff", // blue
  "0xffd23f", // gold
];
const colorForRank = (rank: number) =>
  PALETTE[(rank - 1) % PALETTE.length] ?? "0xffffff";
const paletteColor = (i: number) => PALETTE[i % PALETTE.length] ?? "0xffffff";

// Max height of a rank number (px, at 1080×1920). Big and bold, TikTok-style.
const NUM_FS_MAX = 104;

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

// Approx per-character advance as a fraction of font size for the heavy font
// (calibrated for Arial Black). Used to place multi-colored title words and to
// size labels so they fit; a slight overestimate avoids overlaps/overflow.
const CHAR_W = 0.72;
const estWidth = (text: string, fs: number) => text.length * fs * CHAR_W;

/** Build a single drawtext filter (raw text is escaped here). */
function drawText(o: {
  text: string;
  color: string;
  fs: number;
  x: number | string;
  y: number;
  borderw?: number;
}): string {
  const font = resolveFontFile();
  const fontPart = font ? `fontfile='${font}':` : "";
  const bw = o.borderw ?? 2;
  return (
    `drawtext=${fontPart}text='${escapeDrawText(o.text)}':` +
    `fontcolor=${o.color}:fontsize=${o.fs}:borderw=${bw}:bordercolor=black:` +
    `shadowcolor=black@0.5:shadowx=3:shadowy=3:x=${o.x}:y=${o.y}`
  );
}

/**
 * Render the ranking video with ffmpeg as a "countdown leaderboard".
 *
 *  1. Scale each clip to fully cover the 9:16 frame (full-bleed, center-cropped).
 *  2. A black band across the top holds the overall title (bold, multi-colored
 *     word by word). The numbered ranks are burned directly onto the video,
 *     spread down the left side — big, bold, each a different vibrant color.
 *  3. Clips play in countdown order (highest rank first). A rank's label is
 *     revealed next to its number once that clip has played, and stays on for
 *     the rest of the video; #1 is unveiled last.
 *  4. Concatenate all segments into the final .mp4.
 *
 * Uses a single filter_complex graph so we avoid intermediate files.
 */
export async function renderRankingVideo(opts: RenderOptions): Promise<void> {
  const ffmpeg = useRuntimeConfig().ffmpegPath;
  const width = opts.width ?? W;
  const height = opts.height ?? H;
  const fps = opts.fps ?? 30;
  const cap = opts.perClipSeconds ?? 0;

  const n = opts.clips.length;
  if (n === 0) {
    throw new Error("No clips to render");
  }

  // --- Layout ---
  const marginX = 55;
  const spaceFactor = 0.3;
  const maxTitleW = width - marginX * 2;

  // ---- Title: bold, multi-colored, wrapped onto up to 2 centered lines ----
  const words = opts.title.split(/\s+/).filter(Boolean);
  const lineWidth = (ws: string[], fs: number) =>
    ws.reduce((s, w) => s + estWidth(w, fs), 0) +
    fs * spaceFactor * Math.max(0, ws.length - 1);

  // Greedy word-wrap into lines that each fit maxTitleW at font size fs.
  const wrap = (fs: number): string[][] => {
    const lines: string[][] = [];
    let line: string[] = [];
    for (const w of words) {
      if (line.length && lineWidth([...line, w], fs) > maxTitleW) {
        lines.push(line);
        line = [w];
      } else {
        line.push(w);
      }
    }
    if (line.length) lines.push(line);
    return lines;
  };

  // Start big and shrink only until it fits in at most 2 lines.
  let titleFs = 88;
  let titleLines = wrap(titleFs);
  while (titleLines.length > 2 && titleFs > 34) {
    titleFs -= 4;
    titleLines = wrap(titleFs);
  }

  const titleLineGap = Math.round(titleFs * 0.16);
  const titleTopPad = 28;
  const titleBandH =
    titleLines.length > 0
      ? titleTopPad * 2 +
        titleLines.length * titleFs +
        (titleLines.length - 1) * titleLineGap
      : 0;

  let wordIdx = 0;
  const titleDraws: string[] = [];
  titleLines.forEach((ws, li) => {
    let cursor = Math.max(
      marginX,
      Math.round((width - lineWidth(ws, titleFs)) / 2),
    );
    const y = titleTopPad + li * (titleFs + titleLineGap);
    for (const w of ws) {
      titleDraws.push(
        drawText({
          text: w,
          color: paletteColor(wordIdx),
          fs: titleFs,
          x: Math.round(cursor),
          y,
          borderw: 4,
        }),
      );
      cursor += estWidth(w, titleFs) + titleFs * spaceFactor;
      wordIdx += 1;
    }
  });
  const titleLayer = titleDraws.length ? titleDraws.join(",") + "," : "";

  // ---- Ranks: a vertically-centered block (not stretched), with a generous
  // gap between rows. Number + label share ONE font size so they read as a
  // single unit; they shrink together only if a long label would overflow. ----
  const rowGap = 44;
  const availH = height - titleBandH - 120; // usable area below the title band
  const numGap = 16; // px between the number and its label

  const maxLabelLen = Math.max(
    1,
    ...opts.clips.map((c) => (c.label ?? "").trim().length),
  );
  // Largest font that keeps the widest row (2-digit number + longest label)
  // inside the frame...
  const widthFit = Math.floor(
    (width - marginX - numGap - 20) / ((3 + maxLabelLen) * CHAR_W),
  );
  // ...and that still lets all rows stack vertically.
  const vertFit = Math.floor((availH - (n - 1) * rowGap) / n);
  const rowFs = clamp(Math.min(NUM_FS_MAX, widthFit, vertFit), 40, NUM_FS_MAX);
  const numFs = rowFs;
  const labelFs = rowFs;
  const numBorder = Math.max(5, Math.round(numFs * 0.07));
  const labelBorder = Math.max(3, Math.round(labelFs * 0.07));

  const rowStride = numFs + rowGap;
  const blockH = n * numFs + (n - 1) * rowGap;
  const blockTop = Math.round(titleBandH + (height - titleBandH - blockH) / 2);

  // Rows rank-ascending (1. at top → N. at bottom).
  const rows = [...opts.clips]
    .sort((a, b) => a.rank - b.rank)
    .map((clip, idx) => ({
      rank: clip.rank,
      label: (clip.label ?? "").trim(),
      y: blockTop + idx * rowStride,
    }));

  // Countdown: the highest-ranked clip plays first, #1 plays last.
  const playback = [...opts.clips].sort((a, b) => b.rank - a.rank);

  // Not every clip has an audio track (screen recordings, muted exports, some
  // downloads). Referencing [i:a] for a silent source makes ffmpeg abort with
  // "Error binding filtergraph inputs/outputs", so probe each clip and
  // synthesize silence for the ones without audio.
  const audioInfo = await Promise.all(
    playback.map(async (clip) => ({
      has: await hasAudioStream(clip.filePath),
      dur: await probeDurationSeconds(clip.filePath),
    })),
  );

  const inputs: string[] = [];
  const filters: string[] = [];
  const concatLabels: string[] = [];

  playback.forEach((clip, i) => {
    inputs.push("-i", clip.filePath);

    const currentRank = clip.rank;
    const trim = cap > 0 ? `,trim=duration=${cap},setpts=PTS-STARTPTS` : "";
    const vlabel = `v${i}`;

    // A row's label is shown once its clip has played (we count down from N to
    // 1, so a rank is revealed when its number is >= the rank on screen).
    const rowDraws = rows.flatMap((row) => {
      const numText = `${row.rank}.`;
      const draws = [
        drawText({
          text: numText,
          color: colorForRank(row.rank),
          fs: numFs,
          x: marginX,
          y: row.y,
          borderw: numBorder,
        }),
      ];
      if (row.rank >= currentRank && row.label) {
        draws.push(
          drawText({
            text: row.label,
            color: "white",
            fs: labelFs,
            x: Math.round(marginX + estWidth(numText, numFs) + numGap),
            y: row.y,
            borderw: labelBorder,
          }),
        );
      }
      return draws;
    });

    filters.push(
      `[${i}:v]` +
        // Full-bleed: cover the whole 9:16 frame, center-cropping the overflow.
        `scale=${width}:${height}:force_original_aspect_ratio=increase,` +
        `crop=${width}:${height},setsar=1,fps=${fps}${trim},` +
        // Black title band + bold multi-colored title.
        `drawbox=x=0:y=0:w=${width}:h=${titleBandH}:color=black:t=fill,` +
        titleLayer +
        // Ranks burned onto the video.
        rowDraws.join(",") +
        `[${vlabel}]`,
    );

    // Audio: use the real track when present, otherwise synthesize silence of
    // the same length so every concat segment has a valid [v][a] pair.
    const alabel = `a${i}`;
    const { has: hasAud, dur } = audioInfo[i] ?? { has: false, dur: null };
    const aFormat =
      "aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo";
    if (hasAud) {
      filters.push(
        `[${i}:a]${aFormat},asetpts=PTS-STARTPTS${
          cap > 0 ? `,atrim=duration=${cap}` : ""
        }[${alabel}]`,
      );
    } else {
      // Match the segment's video duration (bounded by cap when set).
      const segDur = cap > 0 ? Math.min(cap, dur ?? cap) : (dur ?? 30);
      filters.push(
        `anullsrc=r=44100:cl=stereo:d=${segDur},${aFormat},asetpts=PTS-STARTPTS[${alabel}]`,
      );
    }

    concatLabels.push(`[${vlabel}][${alabel}]`);
  });

  const concat = `${concatLabels.join("")}concat=n=${n}:v=1:a=1[outv][outa]`;
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

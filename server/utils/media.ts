import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/**
 * Run a child process with a hard timeout. yt-dlp/ffmpeg can hang when a
 * platform changes its internals, so every call is bounded and killed cleanly.
 */
export function runCommand(
  cmd: string,
  args: string[],
  { timeoutMs = 120_000 }: { timeoutMs?: number } = {},
): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: stderr + String(err), timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

/**
 * Download a social clip via yt-dlp to `outPath`.
 * Throws a user-friendly error on failure/timeout — extractors break often,
 * so we never leave the request hanging.
 */
export async function downloadWithYtDlp(
  url: string,
  outPath: string,
  { timeoutMs = 90_000 }: { timeoutMs?: number } = {},
): Promise<void> {
  const config = useRuntimeConfig();
  const bin = config.ytDlpPath;

  // Instagram/TikTok increasingly gate public media behind a session. Pass
  // cookies when configured so downloads succeed.
  const cookieArgs: string[] = [];
  if (config.ytDlpCookiesFile) {
    cookieArgs.push("--cookies", config.ytDlpCookiesFile);
  } else if (config.ytDlpCookiesFromBrowser) {
    cookieArgs.push("--cookies-from-browser", config.ytDlpCookiesFromBrowser);
  }

  const res = await runCommand(
    bin,
    [
      "--no-playlist",
      "--no-warnings",
      "--force-overwrites",
      ...cookieArgs,
      // Prefer a single mp4 stream when available for simpler downstream muxing.
      "-f",
      "mp4/bestvideo*+bestaudio/best",
      "--merge-output-format",
      "mp4",
      "-o",
      outPath,
      url,
    ],
    { timeoutMs },
  );

  if (res.timedOut) {
    throw createError({
      statusCode: 504,
      statusMessage: "Timed out fetching this link. Please try again.",
    });
  }
  if (res.code !== 0) {
    console.error("[yt-dlp] failed:", res.stderr.slice(-800));
    throw createError({
      statusCode: 422,
      statusMessage: classifyYtDlpError(res.stderr, Boolean(cookieArgs.length)),
    });
  }
}

/**
 * Turn yt-dlp stderr into a user-actionable message. Instagram in particular
 * now needs authentication for most posts, so we call that out explicitly.
 */
function classifyYtDlpError(stderr: string, hasCookies: boolean): string {
  const s = stderr.toLowerCase();

  if (
    s.includes("empty media response") ||
    s.includes("login required") ||
    s.includes("requires authentication") ||
    s.includes("use --cookies") ||
    s.includes("rate-limit") ||
    s.includes("429")
  ) {
    return hasCookies
      ? "This post needs a logged-in account and the configured session couldn't access it. It may be private, age-restricted, or the session expired."
      : "Instagram requires a logged-in session to fetch this clip. Upload the video from your device instead, or configure yt-dlp cookies on the server.";
  }
  if (s.includes("private")) {
    return "This post is private. Only public posts can be imported.";
  }
  if (s.includes("unable to extract") || s.includes("not a valid url")) {
    return "Couldn't read a video from this link. Paste a link to a specific Reel or post (not a profile or homepage).";
  }
  return "Couldn't fetch this link. It may be private, removed, or unsupported.";
}

/** Probe a media file's duration in seconds (null if unknown). */
export async function probeDurationSeconds(
  filePath: string,
): Promise<number | null> {
  const bin = useRuntimeConfig().ffprobePath;
  const res = await runCommand(
    bin,
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ],
    { timeoutMs: 20_000 },
  );
  const val = parseFloat(res.stdout.trim());
  return Number.isFinite(val) ? val : null;
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

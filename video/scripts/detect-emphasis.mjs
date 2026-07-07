import { spawnSync } from "node:child_process";

// How wide each RMS analysis window is.
const WINDOW_SECONDS = 0.2;
// How much louder (in dB) than the local rolling average a window must be
// to count as an "emphasis" moment (raised voice).
const PEAK_THRESHOLD_DB = 6;
// Minimum spacing between two detected emphasis moments.
const MIN_GAP_MS = 1200;

/**
 * Runs ffmpeg's astats filter in fixed windows over a wav file and returns
 * a list of timestamps (ms) where the speaker's volume spikes noticeably
 * above their rolling average -- used to trigger "punch zoom" moments.
 */
export const detectEmphasis = (wavPath) => {
  const result = spawnSync(
    "ffmpeg",
    [
      "-i",
      wavPath,
      "-af",
      `asetnsamples=n=${Math.round(16000 * WINDOW_SECONDS)}:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-`,
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf-8", maxBuffer: 1024 * 1024 * 64 },
  );

  const output = result.stdout ?? "";
  const levels = [];
  let currentFrame = null;

  for (const line of output.split("\n")) {
    const frameMatch = line.match(/frame:(\d+)\s+pts_time:([\d.]+)/);
    if (frameMatch) {
      currentFrame = parseFloat(frameMatch[2]) * 1000;
      continue;
    }
    const levelMatch = line.match(/RMS_level=(-?[\d.]+|-inf)/);
    if (levelMatch && currentFrame !== null) {
      const db = levelMatch[1] === "-inf" ? -100 : parseFloat(levelMatch[1]);
      levels.push({ timeMs: currentFrame, db });
      currentFrame = null;
    }
  }

  if (levels.length === 0) return [];

  const rollingWindow = Math.round(3000 / (WINDOW_SECONDS * 1000));
  const peaks = [];
  let lastPeakMs = -Infinity;

  for (let i = 0; i < levels.length; i++) {
    const start = Math.max(0, i - rollingWindow);
    const windowSlice = levels.slice(start, i + 1);
    const avg =
      windowSlice.reduce((sum, l) => sum + l.db, 0) / windowSlice.length;

    if (
      levels[i].db - avg >= PEAK_THRESHOLD_DB &&
      levels[i].timeMs - lastPeakMs >= MIN_GAP_MS
    ) {
      peaks.push(Math.round(levels[i].timeMs));
      lastPeakMs = levels[i].timeMs;
    }
  }

  return peaks;
};

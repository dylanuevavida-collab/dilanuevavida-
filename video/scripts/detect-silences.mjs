import { spawnSync } from "node:child_process";

// Minimum silence duration to be considered for a jump cut.
export const MIN_SILENCE_MS = 350;
// dB threshold below which audio is considered silent.
const NOISE_FLOOR_DB = "-32dB";

/**
 * Runs ffmpeg's silencedetect filter over a wav file and returns
 * a list of {startMs, endMs} silence ranges.
 */
export const detectSilences = (wavPath) => {
  const result = spawnSync(
    "ffmpeg",
    [
      "-i",
      wavPath,
      "-af",
      `silencedetect=noise=${NOISE_FLOOR_DB}:d=${(MIN_SILENCE_MS / 1000).toFixed(2)}`,
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf-8" },
  );
  const stderr = result.stderr ?? "";

  const ranges = [];
  let pendingStart = null;

  const startRegex = /silence_start:\s*(-?[\d.]+)/;
  const endRegex = /silence_end:\s*(-?[\d.]+)/;

  for (const line of stderr.split("\n")) {
    const startMatch = line.match(startRegex);
    if (startMatch) {
      pendingStart = Math.max(0, parseFloat(startMatch[1]) * 1000);
      continue;
    }
    const endMatch = line.match(endRegex);
    if (endMatch && pendingStart !== null) {
      ranges.push({
        startMs: pendingStart,
        endMs: parseFloat(endMatch[1]) * 1000,
        reason: "silence",
      });
      pendingStart = null;
    }
  }

  return ranges;
};

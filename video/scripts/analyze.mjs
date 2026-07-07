import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
  lstatSync,
} from "node:fs";
import path from "node:path";
import {
  WHISPER_LANG,
  WHISPER_MODEL,
  WHISPER_PATH,
  WHISPER_VERSION,
} from "../whisper-config.mjs";
import {
  downloadWhisperModel,
  installWhisperCpp,
  transcribe,
  toCaptions,
} from "@remotion/install-whisper-cpp";
import { detectSilences } from "./detect-silences.mjs";
import { detectEmphasis } from "./detect-emphasis.mjs";
import { findFillerRanges } from "./filler-words.mjs";
import { buildCutRanges, buildKeepSegments } from "./build-cuts.mjs";
import { pickKeywords } from "./pick-keywords.mjs";

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mkv", ".mov"];

const checkFfmpegAvailable = () => {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    execSync("ffprobe -version", { stdio: "ignore" });
  } catch {
    console.error(
      "ffmpeg/ffprobe not found on your PATH. This pipeline needs a full " +
        "system install (not just Remotion's bundled binary) for silence, " +
        "filler and emphasis detection.\n" +
        "  macOS:   brew install ffmpeg\n" +
        "  Windows: winget install ffmpeg  (or choco install ffmpeg)\n" +
        "  Linux:   sudo apt install ffmpeg",
    );
    process.exit(1);
  }
};

const getDurationMs = (filePath) => {
  const output = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrapper=1:nokey=1 "${filePath}"`,
    { encoding: "utf-8" },
  );
  return parseFloat(output.trim()) * 1000;
};

const extractWav = (videoPath, wavPath) => {
  execSync(`ffmpeg -i "${videoPath}" -ar 16000 -ac 1 "${wavPath}" -y`, {
    stdio: ["ignore", "inherit", "inherit"],
  });
};

const transcribeToCaptions = async (wavPath) => {
  const whisperCppOutput = await transcribe({
    inputPath: wavPath,
    model: WHISPER_MODEL,
    tokenLevelTimestamps: true,
    whisperPath: WHISPER_PATH,
    whisperCppVersion: WHISPER_VERSION,
    printOutput: false,
    translateToEnglish: false,
    language: WHISPER_LANG,
    splitOnWord: true,
  });
  const { captions } = toCaptions({ whisperCppOutput });
  return captions;
};

// Remaps a source-timeline millisecond value into edited-timeline
// milliseconds, or null if it falls inside a removed range.
const remapMs = (ms, segments) => {
  for (const seg of segments) {
    if (ms >= seg.sourceStartMs && ms <= seg.sourceEndMs) {
      return seg.editedStartMs + (ms - seg.sourceStartMs);
    }
  }
  return null;
};

const analyzeFile = async (videoPath) => {
  const dir = path.dirname(videoPath);
  const base = path.basename(videoPath).replace(/\.[^.]+$/, "");
  const analysisDir = path.join(process.cwd(), "public", "analysis");
  const outPath = path.join(analysisDir, `${base}.json`);

  if (existsSync(outPath)) {
    console.log(`Skipping ${base} (analysis already exists at ${outPath})`);
    return;
  }

  console.log(`\n=== Analyzing ${base} ===`);
  mkdirSync(analysisDir, { recursive: true });

  const tempDir = path.join(process.cwd(), "temp");
  const isNewTempDir = !existsSync(tempDir);
  if (isNewTempDir) mkdirSync(tempDir);
  const wavPath = path.join(tempDir, `${base}.wav`);

  console.log("1/6 Extracting audio...");
  extractWav(videoPath, wavPath);

  console.log("2/6 Transcribing (Whisper, es)...");
  const captions = await transcribeToCaptions(wavPath);

  console.log("3/6 Detecting silences...");
  const totalMs = getDurationMs(videoPath);
  const silences = detectSilences(wavPath);

  console.log("4/6 Detecting filler words (muletillas)...");
  const fillers = findFillerRanges(captions);

  console.log("5/6 Detecting emphasis (raised voice) for punch zooms...");
  const emphasisSourceMs = detectEmphasis(wavPath);

  console.log("6/6 Building cut list and keyword highlights...");
  const removeRanges = buildCutRanges({ silences, fillers, totalMs });
  const segments = buildKeepSegments(removeRanges, totalMs);

  const { keywordIndexes, hookIndex } = pickKeywords(captions);
  const keywordSet = new Set(keywordIndexes);

  const remappedCaptions = captions
    .map((c, i) => {
      const midMs = (c.startMs + c.endMs) / 2;
      const editedStartMs = remapMs(c.startMs, segments);
      const editedEndMs = remapMs(c.endMs, segments);
      const isInsideCut = remapMs(midMs, segments) === null;
      if (isInsideCut || editedStartMs === null || editedEndMs === null) {
        return null;
      }
      return {
        text: c.text,
        editedStartMs,
        editedEndMs,
        isKeyword: keywordSet.has(i),
        isHookWord: hookIndex === i,
      };
    })
    .filter(Boolean);

  const emphasisMs = emphasisSourceMs
    .map((ms) => remapMs(ms, segments))
    .filter((ms) => ms !== null);

  const analysis = {
    src: `videos/${path.basename(videoPath)}`,
    totalSourceMs: totalMs,
    totalEditedMs: segments.length
      ? segments[segments.length - 1].editedEndMs
      : 0,
    segments,
    captions: remappedCaptions,
    emphasisMs,
    removeRanges,
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(outPath, JSON.stringify(analysis, null, 2));
  console.log(`Wrote ${path.relative(process.cwd(), outPath)}`);
  console.log(
    `  ${(totalMs / 1000).toFixed(1)}s source -> ${(
      analysis.totalEditedMs / 1000
    ).toFixed(1)}s edited (${removeRanges.length} cuts, ${
      emphasisMs.length
    } emphasis moments, ${keywordSet.size} keywords, hook word: ${
      hookIndex !== null ? captions[hookIndex].text : "(none found)"
    })`,
  );

  if (isNewTempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
};

const processDirectory = async (directory) => {
  const entries = readdirSync(directory);
  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    if (lstatSync(fullPath).isDirectory()) {
      await processDirectory(fullPath);
      continue;
    }
    if (VIDEO_EXTENSIONS.includes(path.extname(entry).toLowerCase())) {
      await analyzeFile(fullPath);
    }
  }
};

const args = process.argv.slice(2);
const defaultVideosDir = path.join(process.cwd(), "public", "videos");

if (args.length === 0 && !existsSync(defaultVideosDir)) {
  console.error(
    `No videos found. Run this first:\n  npm run import-clips -- "path/to/your/clips"`,
  );
  process.exit(1);
}

checkFfmpegAvailable();
await installWhisperCpp({ to: WHISPER_PATH, version: WHISPER_VERSION });
await downloadWhisperModel({ folder: WHISPER_PATH, model: WHISPER_MODEL });

if (args.length === 0) {
  await processDirectory(defaultVideosDir);
} else {
  for (const arg of args) {
    const fullPath = path.resolve(arg);
    if (lstatSync(fullPath).isDirectory()) {
      await processDirectory(fullPath);
    } else {
      await analyzeFile(fullPath);
    }
  }
}

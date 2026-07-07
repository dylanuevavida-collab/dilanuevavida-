import { copyFileSync, existsSync, mkdirSync, readdirSync, lstatSync } from "node:fs";
import path from "node:path";

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mkv", ".mov"];

const sourceDir = process.argv[2];
if (!sourceDir) {
  console.error(
    "Usage: npm run import-clips -- \"C:\\Users\\dylan\\Desktop\\videos pra editar\"",
  );
  process.exit(1);
}

if (!existsSync(sourceDir)) {
  console.error(`Folder not found: ${sourceDir}`);
  process.exit(1);
}

const destDir = path.join(process.cwd(), "public", "videos");
mkdirSync(destDir, { recursive: true });

const entries = readdirSync(sourceDir).filter((f) =>
  VIDEO_EXTENSIONS.includes(path.extname(f).toLowerCase()),
);

if (entries.length === 0) {
  console.log(`No video files (${VIDEO_EXTENSIONS.join(", ")}) found in ${sourceDir}`);
  process.exit(0);
}

for (const entry of entries) {
  const from = path.join(sourceDir, entry);
  if (lstatSync(from).isDirectory()) continue;
  const to = path.join(destDir, entry);
  copyFileSync(from, to);
  console.log(`Copied ${entry} -> public/videos/${entry}`);
}

console.log(
  `\nDone. Next: npm run analyze  (transcribes + detects cuts for everything in public/videos)`,
);

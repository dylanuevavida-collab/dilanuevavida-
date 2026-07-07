import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Procedurally synthesized placeholder SFX (pure JS, no ffmpeg needed) so
// the pipeline works out of the box. Swap these for real SFX from your own
// library any time -- just keep the filenames in public/sfx/.
const SAMPLE_RATE = 44100;

const writeWav = (filePath, samples) => {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  writeFileSync(filePath, buffer);
};

const seconds = (s) => Math.round(s * SAMPLE_RATE);

const sine = (freq, n, phase = 0) =>
  Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE + phase));

const noise = (n) => Array.from({ length: n }, () => Math.random() * 2 - 1);

// One-pole lowpass/highpass to turn white noise into a whoosh-like band.
const lowpass = (data, cutoff) => {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / SAMPLE_RATE;
  const alpha = dt / (rc + dt);
  const out = new Array(data.length);
  out[0] = data[0] * alpha;
  for (let i = 1; i < data.length; i++) {
    out[i] = out[i - 1] + alpha * (data[i] - out[i - 1]);
  }
  return out;
};

const highpass = (data, cutoff) => {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / SAMPLE_RATE;
  const alpha = rc / (rc + dt);
  const out = new Array(data.length);
  out[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    out[i] = alpha * (out[i - 1] + data[i] - data[i - 1]);
  }
  return out;
};

const applyEnvelope = (data, envFn) => data.map((v, i) => v * envFn(i / data.length));

const linearFadeInOut = (fadeInFrac, fadeOutFrac) => (t) => {
  if (t < fadeInFrac) return t / fadeInFrac;
  if (t > 1 - fadeOutFrac) return (1 - t) / fadeOutFrac;
  return 1;
};

const expDecay = (rate) => (t) => Math.exp(-rate * t);

const mix = (...tracks) => {
  const length = Math.max(...tracks.map((t) => t.length));
  const out = new Array(length).fill(0);
  for (const track of tracks) {
    for (let i = 0; i < track.length; i++) out[i] += track[i];
  }
  const max = Math.max(1, ...out.map(Math.abs));
  return out.map((v) => (v / max) * 0.9);
};

const buildWhoosh = () => {
  const n = seconds(0.42);
  let band = highpass(lowpass(noise(n), 2200), 500);
  band = applyEnvelope(band, linearFadeInOut(0.08, 0.55));
  return mix(band);
};

const buildDing = () => {
  const n = seconds(0.4);
  const tone1 = applyEnvelope(sine(1800, n), expDecay(6));
  const tone2 = applyEnvelope(sine(2700, n), expDecay(7));
  return mix(tone1, tone2.map((v) => v * 0.6));
};

const buildImpact = () => {
  const n = seconds(0.3);
  const thump = applyEnvelope(sine(90, n), expDecay(10));
  const clickN = seconds(0.03);
  const click = applyEnvelope(noise(clickN), expDecay(18));
  return mix(thump, click);
};

const sfxDir = path.join(process.cwd(), "public", "sfx");
mkdirSync(sfxDir, { recursive: true });

const jobs = [
  { name: "whoosh.wav", build: buildWhoosh },
  { name: "ding.wav", build: buildDing },
  { name: "impact.wav", build: buildImpact },
];

for (const job of jobs) {
  const outPath = path.join(sfxDir, job.name);
  if (existsSync(outPath)) {
    console.log(`Skipping ${job.name} (already exists)`);
    continue;
  }
  console.log(`Generating public/sfx/${job.name}...`);
  writeWav(outPath, job.build());
}

console.log(
  "\nDone. Replace any of these with your own SFX any time -- just keep the filenames (public/sfx/whoosh.wav, ding.wav, impact.wav).",
);

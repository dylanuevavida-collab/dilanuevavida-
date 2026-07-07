// Spanish filler words / verbal tics ("muletillas") to strip out as jump cuts.
// Matched as whole tokens (case-insensitive, punctuation stripped). Multi-word
// phrases are matched against a sliding window of consecutive tokens.
export const FILLER_SINGLE_WORDS = [
  "eh",
  "ehh",
  "eeh",
  "em",
  "emm",
  "mmm",
  "mmh",
  "ajá",
  "aja",
  "este",
  "esteee",
  "digamos",
  "osea",
];

export const FILLER_PHRASES = [
  ["o", "sea"],
  ["como", "que"],
  ["tipo", "como"],
];

const normalize = (word) =>
  word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");

export const isFillerWord = (word) => FILLER_SINGLE_WORDS.includes(normalize(word));

export const findFillerRanges = (captions) => {
  const ranges = [];
  const normalized = captions.map((c) => normalize(c.text));

  for (let i = 0; i < captions.length; i++) {
    if (isFillerWord(captions[i].text)) {
      ranges.push({
        startMs: captions[i].startMs,
        endMs: captions[i].endMs,
        reason: "filler",
        word: captions[i].text,
      });
      continue;
    }

    for (const phrase of FILLER_PHRASES) {
      if (i + phrase.length > captions.length) continue;
      const slice = normalized.slice(i, i + phrase.length);
      if (slice.every((w, idx) => w === phrase[idx])) {
        ranges.push({
          startMs: captions[i].startMs,
          endMs: captions[i + phrase.length - 1].endMs,
          reason: "filler",
          word: phrase.join(" "),
        });
      }
    }
  }

  return ranges;
};

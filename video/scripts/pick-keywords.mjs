import { isFillerWord } from "./filler-words.mjs";

const STOPWORDS = new Set(
  `de la que el en y a los del se las por un para con no una su al lo como
   más pero sus le ya o este sí porque esta entre cuando muy sin sobre
   también me hasta hay donde quien desde todo nos durante uno les ni contra
   otros ese eso ante ellos e esto mí antes algunos qué unos yo otro otras
   otra él tanto esa estos mucho quienes nada muchos cual poco ella estar
   estas algunas algo nosotros mi mis tú te ti tu tus ellas nosotras
   vosotros vosotras os mío mía míos mías tuyo tuya tuyos tuyas suyo suya
   suyos suyas nuestro nuestra nuestros nuestras vuestro vuestra vuestros
   vuestras esos esas soy eres somos sois estoy estás está estamos estáis
   están voy vas va vamos van fue era eres ser estar hace hacer bien
   entonces ahora si asi así cada todos toda todas cosa cosas vez veces
   pues nunca siempre solo sólo`
    .split(/\s+/)
    .filter(Boolean),
);

const normalize = (word) =>
  word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");

const isContentWord = (caption) => {
  const norm = normalize(caption.text);
  return norm.length >= 4 && !STOPWORDS.has(norm) && !isFillerWord(caption.text);
};

/**
 * Groups captions into ~sentence-length chunks (by pause length) and, within
 * each chunk, ranks content words by length to pick 2-3 "keywords" to
 * highlight on screen. The single strongest content word within the opening
 * hook window is flagged separately as the hook word (styled in red).
 */
export const pickKeywords = (captions, { hookWindowMs = 3000 } = {}) => {
  const keywordIndexes = new Set();
  let hookIndex = null;

  // Group by gaps > 500ms between words, roughly one "frase" per group.
  const groups = [];
  let current = [];
  for (let i = 0; i < captions.length; i++) {
    if (
      current.length > 0 &&
      captions[i].startMs - captions[i - 1].endMs > 500
    ) {
      groups.push(current);
      current = [];
    }
    current.push(i);
  }
  if (current.length > 0) groups.push(current);

  for (const group of groups) {
    const ranked = group
      .filter((i) => isContentWord(captions[i]))
      .sort((a, b) => captions[b].text.length - captions[a].text.length);

    for (const idx of ranked.slice(0, 3)) {
      keywordIndexes.add(idx);
    }
  }

  const hookCandidates = captions
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.startMs <= hookWindowMs && isContentWord(c))
    .sort((a, b) => b.c.text.length - a.c.text.length);

  if (hookCandidates.length > 0) {
    hookIndex = hookCandidates[0].i;
    keywordIndexes.delete(hookIndex);
  }

  return {
    keywordIndexes: [...keywordIndexes],
    hookIndex,
  };
};

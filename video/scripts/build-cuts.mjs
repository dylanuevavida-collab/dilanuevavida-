// Small safety margin kept around each removed range so we don't clip the
// start/end of the words right before/after it.
const PADDING_MS = 30;
// Skip cuts that are too small to be worth a jump cut.
const MIN_CUT_MS = 80;

export const buildCutRanges = ({ silences, fillers, totalMs }) => {
  const padded = [...silences, ...fillers]
    .map((r) => ({
      startMs: Math.max(0, r.startMs + PADDING_MS),
      endMs: Math.min(totalMs, r.endMs - PADDING_MS),
      reason: r.reason,
    }))
    .filter((r) => r.endMs - r.startMs >= MIN_CUT_MS)
    .sort((a, b) => a.startMs - b.startMs);

  const merged = [];
  for (const range of padded) {
    const last = merged[merged.length - 1];
    if (last && range.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, range.endMs);
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
};

/**
 * Given the ranges to remove, returns the ranges to keep (the actual edited
 * timeline), each annotated with where it lands on the new, cut timeline.
 */
export const buildKeepSegments = (removeRanges, totalMs) => {
  const segments = [];
  let cursor = 0;

  for (const range of removeRanges) {
    if (range.startMs > cursor) {
      segments.push({ sourceStartMs: cursor, sourceEndMs: range.startMs });
    }
    cursor = Math.max(cursor, range.endMs);
  }
  if (cursor < totalMs) {
    segments.push({ sourceStartMs: cursor, sourceEndMs: totalMs });
  }

  let editedCursor = 0;
  return segments
    .filter((s) => s.sourceEndMs - s.sourceStartMs > 0)
    .map((s) => {
      const durationMs = s.sourceEndMs - s.sourceStartMs;
      const segment = {
        ...s,
        editedStartMs: editedCursor,
        editedEndMs: editedCursor + durationMs,
      };
      editedCursor += durationMs;
      return segment;
    });
};

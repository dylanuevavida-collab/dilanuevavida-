import type { AnalysisCaption } from "./types";

export type TokenFlags = {
  isKeyword: boolean;
  isHookWord: boolean;
};

export const buildFlagsByKey = (
  captions: AnalysisCaption[],
): Map<string, TokenFlags> => {
  const map = new Map<string, TokenFlags>();
  for (const c of captions) {
    map.set(`${c.editedStartMs}-${c.text}`, {
      isKeyword: c.isKeyword,
      isHookWord: c.isHookWord,
    });
  }
  return map;
};

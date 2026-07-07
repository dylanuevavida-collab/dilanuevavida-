export type Segment = {
  sourceStartMs: number;
  sourceEndMs: number;
  editedStartMs: number;
  editedEndMs: number;
};

export type AnalysisCaption = {
  text: string;
  editedStartMs: number;
  editedEndMs: number;
  isKeyword: boolean;
  isHookWord: boolean;
};

export type Analysis = {
  src: string;
  totalSourceMs: number;
  totalEditedMs: number;
  segments: Segment[];
  captions: AnalysisCaption[];
  emphasisMs: number[];
  removeRanges: { startMs: number; endMs: number; reason: string }[];
  generatedAt: string;
};

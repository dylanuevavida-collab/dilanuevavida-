import { TikTokPage } from "@remotion/captions";
import React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Page } from "./Page";
import type { TokenFlags } from "./caption-flags";

const SubtitlePage: React.FC<{
  readonly page: TikTokPage;
  readonly flagsByKey: Map<string, TokenFlags>;
}> = ({ page, flagsByKey }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: {
      damping: 200,
    },
    durationInFrames: 5,
  });

  return (
    <AbsoluteFill>
      <Page enterProgress={enter} page={page} flagsByKey={flagsByKey} />
    </AbsoluteFill>
  );
};

export default SubtitlePage;

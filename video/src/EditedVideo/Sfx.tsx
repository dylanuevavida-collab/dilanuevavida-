import React from "react";
import { Audio, Sequence, staticFile } from "remotion";

const msToFrames = (ms: number, fps: number) => Math.round((ms / 1000) * fps);

export const SfxLayer: React.FC<{
  fps: number;
  cutMs: number[];
  emphasisMs: number[];
  keywordMs: number[];
}> = ({ fps, cutMs, emphasisMs, keywordMs }) => {
  return (
    <>
      {cutMs.map((ms, i) => {
        const from = msToFrames(ms, fps) - 2;
        if (from < 0) return null;
        return (
          <Sequence key={`whoosh-${i}`} from={from} durationInFrames={Math.round(fps * 0.45)}>
            <Audio src={staticFile("sfx/whoosh.wav")} volume={0.55} />
          </Sequence>
        );
      })}
      {emphasisMs.map((ms, i) => {
        const from = msToFrames(ms, fps);
        return (
          <Sequence key={`ding-${i}`} from={from} durationInFrames={Math.round(fps * 0.35)}>
            <Audio src={staticFile("sfx/ding.wav")} volume={0.45} />
          </Sequence>
        );
      })}
      {keywordMs.map((ms, i) => {
        const from = msToFrames(ms, fps);
        return (
          <Sequence key={`impact-${i}`} from={from} durationInFrames={Math.round(fps * 0.3)}>
            <Audio src={staticFile("sfx/impact.wav")} volume={0.35} />
          </Sequence>
        );
      })}
    </>
  );
};

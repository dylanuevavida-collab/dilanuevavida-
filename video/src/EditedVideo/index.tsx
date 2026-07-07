import { Caption, createTikTokStyleCaptions } from "@remotion/captions";
import { getVideoMetadata } from "@remotion/media-utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  OffthreadVideo,
  Sequence,
  cancelRender,
  staticFile,
  useCurrentFrame,
  useDelayRender,
  useVideoConfig,
  watchStaticFile,
} from "remotion";
import { z } from "zod";
import { loadFont } from "../load-font";
import { NoAnalysisFile } from "./NoAnalysisFile";
import { SfxLayer } from "./Sfx";
import SubtitlePage from "./SubtitlePage";
import { buildFlagsByKey } from "./caption-flags";
import type { Analysis } from "./types";
import { getZoomScale } from "./zoom";

export const editedVideoSchema = z.object({
  src: z.string(),
  analysisSrc: z.string(),
});

// How much to boost the speaker's voice on export (150-200% requested).
const VOLUME_BOOST = 1.8;
// How many words/tokens are shown together before advancing to the next
// caption page -- kept short for a snappy, word-by-word karaoke feel.
const SWITCH_CAPTIONS_EVERY_MS = 900;

export const calculateEditedVideoMetadata: CalculateMetadataFunction<
  z.infer<typeof editedVideoSchema>
> = async ({ props }) => {
  const fps = 30;
  try {
    const res = await fetch(staticFile(props.analysisSrc));
    if (!res.ok) throw new Error("no analysis file yet");
    const analysis = (await res.json()) as Analysis;
    return {
      fps,
      durationInFrames: Math.max(
        1,
        Math.round((analysis.totalEditedMs / 1000) * fps),
      ),
    };
  } catch {
    // No analysis yet (haven't run `npm run analyze`): fall back to the raw
    // source video's own duration so the Studio still loads.
    const metadata = await getVideoMetadata(staticFile(props.src));
    return {
      fps,
      durationInFrames: Math.max(1, Math.floor(metadata.durationInSeconds * fps)),
    };
  }
};

const msToFrames = (ms: number, fps: number) => Math.round((ms / 1000) * fps);

export const EditedVideo: React.FC<{
  src: string;
  analysisSrc: string;
}> = ({ src, analysisSrc }) => {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [missing, setMissing] = useState(false);
  const { delayRender, continueRender } = useDelayRender();
  const [handle] = useState(() => delayRender());
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const fetchAnalysis = useCallback(async () => {
    try {
      await loadFont();
      const res = await fetch(staticFile(analysisSrc));
      if (!res.ok) {
        setMissing(true);
        continueRender(handle);
        return;
      }
      const data = (await res.json()) as Analysis;
      setAnalysis(data);
      setMissing(false);
      continueRender(handle);
    } catch (e) {
      cancelRender(e);
    }
  }, [analysisSrc, continueRender, handle]);

  useEffect(() => {
    fetchAnalysis();
    const c = watchStaticFile(staticFile(analysisSrc), () => {
      fetchAnalysis();
    });
    return () => c.cancel();
  }, [analysisSrc, fetchAnalysis]);

  const editedCaptions: Caption[] = useMemo(() => {
    if (!analysis) return [];
    return analysis.captions.map((c) => ({
      text: c.text,
      startMs: c.editedStartMs,
      endMs: c.editedEndMs,
      timestampMs: null,
      confidence: null,
    }));
  }, [analysis]);

  const { pages } = useMemo(
    () =>
      createTikTokStyleCaptions({
        captions: editedCaptions,
        combineTokensWithinMilliseconds: SWITCH_CAPTIONS_EVERY_MS,
      }),
    [editedCaptions],
  );

  const flagsByKey = useMemo(
    () => buildFlagsByKey(analysis?.captions ?? []),
    [analysis],
  );

  const zoomScale = useMemo(
    () =>
      getZoomScale({
        frame,
        fps,
        emphasisMsList: analysis?.emphasisMs ?? [],
      }),
    [frame, fps, analysis],
  );

  if (!analysis || missing) {
    return (
      <AbsoluteFill style={{ backgroundColor: "black" }}>
        <OffthreadVideo
          src={staticFile(src)}
          style={{ objectFit: "cover", width: "100%", height: "100%" }}
        />
        {missing ? <NoAnalysisFile analysisSrc={analysisSrc} /> : null}
      </AbsoluteFill>
    );
  }

  const cutMs = analysis.segments.slice(1).map((s) => s.editedStartMs);
  const keywordMs = analysis.captions
    .filter((c) => c.isKeyword || c.isHookWord)
    .map((c) => c.editedStartMs);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <AbsoluteFill
        style={{
          transform: `scale(${zoomScale})`,
          transformOrigin: "50% 38%",
        }}
      >
        {analysis.segments.map((segment, i) => {
          const editedStartFrame = msToFrames(segment.editedStartMs, fps);
          const editedEndFrame = msToFrames(segment.editedEndMs, fps);
          const durationInFrames = editedEndFrame - editedStartFrame;
          if (durationInFrames <= 0) return null;
          const sourceStartFrame = msToFrames(segment.sourceStartMs, fps);

          return (
            <Sequence
              key={i}
              from={editedStartFrame}
              durationInFrames={durationInFrames}
              name={`segment-${i}`}
            >
              <Sequence from={-sourceStartFrame}>
                <OffthreadVideo
                  src={staticFile(analysis.src)}
                  volume={VOLUME_BOOST}
                  style={{ objectFit: "cover", width: "100%", height: "100%" }}
                />
              </Sequence>
            </Sequence>
          );
        })}
      </AbsoluteFill>

      {pages.map((page, index) => {
        const nextPage = pages[index + 1] ?? null;
        const subtitleStartFrame = msToFrames(page.startMs, fps);
        const subtitleEndFrame = Math.min(
          nextPage ? msToFrames(nextPage.startMs, fps) : Infinity,
          subtitleStartFrame + msToFrames(SWITCH_CAPTIONS_EVERY_MS, fps),
        );
        const durationInFrames = subtitleEndFrame - subtitleStartFrame;
        if (durationInFrames <= 0) return null;

        return (
          <Sequence
            key={index}
            from={subtitleStartFrame}
            durationInFrames={durationInFrames}
          >
            <SubtitlePage page={page} flagsByKey={flagsByKey} />
          </Sequence>
        );
      })}

      <SfxLayer
        fps={fps}
        cutMs={cutMs}
        emphasisMs={analysis.emphasisMs}
        keywordMs={keywordMs}
      />
    </AbsoluteFill>
  );
};

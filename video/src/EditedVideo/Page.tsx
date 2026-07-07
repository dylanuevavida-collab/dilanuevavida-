import { makeTransform, scale, translateY } from "@remotion/animation-utils";
import { TikTokPage } from "@remotion/captions";
import { fitText } from "@remotion/layout-utils";
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TheBoldFont } from "../load-font";
import type { TokenFlags } from "./caption-flags";

const fontFamily = TheBoldFont;

const container: React.CSSProperties = {
  justifyContent: "center",
  alignItems: "center",
  top: undefined,
  bottom: 320,
  height: 220,
};

const DESIRED_FONT_SIZE = 118;
const KEYWORD_COLOR = "#d4622a"; // brand orange, matches dilanuevavida.com
const HOOK_COLOR = "#ef1f1f"; // thumbnail-style red for the main hook word
const WHITE = "#ffffff";
const DIM_WHITE = "rgba(255,255,255,0.62)";

export const Page: React.FC<{
  readonly enterProgress: number;
  readonly page: TikTokPage;
  readonly flagsByKey: Map<string, TokenFlags>;
}> = ({ enterProgress, page, flagsByKey }) => {
  const frame = useCurrentFrame();
  const { width, fps } = useVideoConfig();
  const timeInMs = (frame / fps) * 1000;

  const fittedText = fitText({
    fontFamily,
    text: page.text,
    withinWidth: width * 0.86,
    textTransform: "uppercase",
  });

  const fontSize = Math.min(DESIRED_FONT_SIZE, fittedText.fontSize);

  return (
    <AbsoluteFill style={container}>
      <div
        style={{
          backgroundColor: "rgba(8,8,8,0.72)",
          borderRadius: 20,
          padding: "16px 34px",
          maxWidth: "94%",
          transform: makeTransform([
            scale(interpolate(enterProgress, [0, 1], [0.85, 1])),
            translateY(interpolate(enterProgress, [0, 1], [40, 0])),
          ]),
        }}
      >
        <div
          style={{
            fontSize,
            color: WHITE,
            textAlign: "center",
            fontFamily,
            textTransform: "uppercase",
            lineHeight: 1.05,
          }}
        >
          {page.tokens.map((t) => {
            const startRelativeToSequence = t.fromMs - page.startMs;
            const endRelativeToSequence = t.toMs - page.startMs;
            const active =
              startRelativeToSequence <= timeInMs &&
              endRelativeToSequence > timeInMs;
            const alreadySpoken = timeInMs >= endRelativeToSequence;

            const flags = flagsByKey.get(`${t.fromMs}-${t.text}`);
            const isKeyword = flags?.isKeyword ?? false;
            const isHookWord = flags?.isHookWord ?? false;
            const isHighlighted = isKeyword || isHookWord;

            const localFrame = frame - Math.round((t.fromMs / 1000) * fps);
            const pop = isHighlighted
              ? spring({
                  frame: localFrame,
                  fps,
                  config: { damping: 12, stiffness: 210, mass: 0.5 },
                  durationInFrames: 12,
                })
              : 0;

            let color: string = active || alreadySpoken ? WHITE : DIM_WHITE;
            if (isHookWord) color = HOOK_COLOR;
            else if (isKeyword) color = KEYWORD_COLOR;

            const tokenScale = isHighlighted
              ? interpolate(pop, [0, 1], [1.25, 1.08])
              : 1;

            return (
              <span
                key={`${t.fromMs}-${t.text}`}
                style={{
                  display: "inline-block",
                  whiteSpace: "pre",
                  color,
                  fontWeight: isHighlighted ? 700 : undefined,
                  transform: `scale(${tokenScale})`,
                  transformOrigin: "center bottom",
                }}
              >
                {t.text}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

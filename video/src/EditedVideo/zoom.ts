import { Easing, interpolate } from "remotion";

// Progressive "hook" zoom: subtle push-in over the first 3 seconds, then
// holds at that framing for the rest of the video.
export const HOOK_ZOOM_DURATION_MS = 3000;
export const HOOK_ZOOM_SCALE = 0.07;

// Quick "punch zoom" bump layered on top at each emphasis (raised-voice) moment.
export const PUNCH_ZOOM_SCALE = 0.09;
export const PUNCH_ZOOM_HALF_WINDOW_MS = 160;

export const getZoomScale = ({
  frame,
  fps,
  emphasisMsList,
}: {
  frame: number;
  fps: number;
  emphasisMsList: number[];
}): number => {
  const timeMs = (frame / fps) * 1000;

  const hook = interpolate(
    timeMs,
    [0, HOOK_ZOOM_DURATION_MS],
    [0, HOOK_ZOOM_SCALE],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );

  let punch = 0;
  for (const emphasisMs of emphasisMsList) {
    const deltaMs = Math.abs(timeMs - emphasisMs);
    if (deltaMs > PUNCH_ZOOM_HALF_WINDOW_MS) continue;
    const t = 1 - deltaMs / PUNCH_ZOOM_HALF_WINDOW_MS;
    const eased = Easing.out(Easing.quad)(t);
    punch = Math.max(punch, PUNCH_ZOOM_SCALE * eased);
  }

  return 1 + hook + punch;
};

import React from "react";
import { AbsoluteFill } from "remotion";

export const NoAnalysisFile: React.FC<{ analysisSrc: string }> = ({
  analysisSrc,
}) => {
  return (
    <AbsoluteFill
      style={{
        height: "auto",
        width: "100%",
        backgroundColor: "white",
        fontSize: 36,
        padding: 30,
        top: undefined,
        fontFamily: "sans-serif",
      }}
    >
      No analysis file found at <code>public/{analysisSrc}</code>. <br />
      Run <code>npm run import-clips -- "path/to/your/clips"</code> then{" "}
      <code>npm run analyze</code> to transcribe and detect cuts.
    </AbsoluteFill>
  );
};

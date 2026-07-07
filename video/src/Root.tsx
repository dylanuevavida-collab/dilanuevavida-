import "./index.css";
import { Composition } from "remotion";
import {
  EditedVideo,
  calculateEditedVideoMetadata,
  editedVideoSchema,
} from "./EditedVideo";

// Each <Composition> is an entry in the sidebar!
// To edit a new clip: npm run import-clips -- "path/to/your/clips",
// then npm run analyze, then change `src`/`analysisSrc` below (or pass
// them as input props) to point at the clip you want to preview/render.

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="EditedVideo"
      component={EditedVideo}
      calculateMetadata={calculateEditedVideoMetadata}
      schema={editedVideoSchema}
      width={1080}
      height={1920}
      defaultProps={{
        src: "sample-video.mp4",
        analysisSrc: "analysis/sample-video.json",
      }}
    />
  );
};

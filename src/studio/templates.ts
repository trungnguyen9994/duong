import { JourneyPlayer } from "./JourneyPlayer";
import { PicturePlayer } from "./PicturePlayer";
import { WheelPlayer } from "./WheelPlayer";
import { FrogPlayer } from "./FrogPlayer";
import { AdventurePlayer } from "./AdventurePlayer";
export const webTemplates = Object.freeze({
  "forest_rescue@1": AdventurePlayer,
  "boat_rescue@1": AdventurePlayer,
  "football@1": AdventurePlayer,
  "clever_frog@1": FrogPlayer,
  "journey@1": JourneyPlayer,
  "picture_reveal@1": PicturePlayer,
  "word_wheel@1": WheelPlayer,
});

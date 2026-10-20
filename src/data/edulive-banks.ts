import {
  eduliveImport as grade1Import,
  eduliveQuestions as grade1Questions,
} from "./edulive-kntt-grade1-volume2";
import {
  eduliveImport as grade2Import,
  eduliveQuestions as grade2Questions,
} from "./edulive-kntt-grade2-volume2";
import {
  eduliveImport as grade3Import,
  eduliveQuestions as grade3Questions,
} from "./edulive-kntt-grade3-volume2";

export const eduliveBanks = [
  { ...grade1Import, grade: 1, volume: 2 },
  { ...grade2Import, grade: 2, volume: 2 },
  { ...grade3Import, grade: 3, volume: 2 },
];
export const allEduliveQuestions = [
  ...grade1Questions,
  ...grade2Questions,
  ...grade3Questions,
];

import { adventureConfig, isAdventure } from "./adventure-config";
import type { StudioSpec } from "./studio-spec";
export type AdventureSession = {
  phase: "board" | "question" | "answer" | "correct" | "wrong" | "summary";
  active: number | null;
  completed: number[];
  scores: number[];
  team: number;
  attempts: number;
};
export const initialAdventure = (spec: StudioSpec): AdventureSession => ({
  phase: spec.kind === "football" ? "question" : "board",
  active: spec.kind === "football" ? 0 : null,
  completed: [],
  scores: spec.settings.teams.map(() => 0),
  team: 0,
  attempts: 0,
});
export function chooseAdventure(
  spec: StudioSpec,
  state: AdventureSession,
  index: number,
): AdventureSession {
  if (
    !isAdventure(spec.kind) ||
    !("questions" in spec.content) ||
    state.phase !== "board" ||
    state.completed.includes(index) ||
    !spec.content.questions[index]
  )
    return state;
  return { ...state, active: index, phase: "question", attempts: 0 };
}
export function answerAdventure(
  spec: StudioSpec,
  state: AdventureSession,
  choice: number | boolean,
): AdventureSession {
  if (
    !isAdventure(spec.kind) ||
    !("questions" in spec.content) ||
    state.active === null ||
    !["question", "answer"].includes(state.phase)
  )
    return state;
  const q = spec.content.questions[state.active],
    oral = adventureConfig[spec.kind].oral;
  if (
    !q ||
    (oral && state.phase !== "answer") ||
    (!oral && state.phase !== "question")
  )
    return state;
  if (
    typeof choice === "number" &&
    (choice < 0 || choice >= adventureConfig[spec.kind].choices)
  )
    return state;
  const correct = oral ? choice === true : choice === q.correct;
  if (!correct)
    return { ...state, phase: "wrong", attempts: state.attempts + 1 };
  const scores = [...state.scores];
  scores[state.team] += state.attempts
    ? spec.settings.pointsRetry
    : spec.settings.pointsFirst;
  return {
    ...state,
    scores,
    phase: "correct",
    completed: [...state.completed, state.active],
  };
}
export function nextAdventure(
  spec: StudioSpec,
  state: AdventureSession,
): AdventureSession {
  if (
    !isAdventure(spec.kind) ||
    !("questions" in spec.content) ||
    state.phase !== "correct"
  )
    return state;
  const finished = state.completed.length === spec.content.questions.length;
  return {
    ...state,
    team: (state.team + 1) % state.scores.length,
    active: finished
      ? null
      : spec.kind === "football"
        ? state.active! + 1
        : null,
    phase: finished
      ? "summary"
      : spec.kind === "football"
        ? "question"
        : "board",
    attempts: 0,
  };
}

import type { StudioSpec } from "./studio-spec";
export type FrogSession = {
  completed: number[];
  active: number | null;
  team: number;
  scores: number[];
  attempts: number;
  phase: "pond" | "question" | "answer" | "summary";
};
export const initialFrog = (spec: StudioSpec): FrogSession => ({
  completed: [],
  active: null,
  team: 0,
  scores: spec.settings.teams.map(() => 0),
  attempts: 0,
  phase: "pond",
});
export function selectFrog(
  spec: StudioSpec,
  state: FrogSession,
  index: number,
): FrogSession {
  if (
    spec.kind !== "clever_frog" ||
    state.phase !== "pond" ||
    !spec.content.questions[index] ||
    state.completed.includes(index)
  )
    return state;
  return { ...state, active: index, attempts: 0, phase: "question" };
}
export function markFrog(
  spec: StudioSpec,
  state: FrogSession,
  correct: boolean,
): FrogSession {
  if (
    spec.kind !== "clever_frog" ||
    state.phase !== "answer" ||
    state.active === null ||
    state.completed.includes(state.active)
  )
    return state;
  const scores = [...state.scores];
  if (correct)
    scores[state.team] += state.attempts
      ? spec.settings.pointsRetry
      : spec.settings.pointsFirst;
  const completed = [...state.completed, state.active];
  return {
    ...state,
    scores,
    completed,
    active: null,
    team: (state.team + 1) % scores.length,
    phase:
      completed.length === spec.content.questions.length ? "summary" : "pond",
  };
}

export type Session = {
  index: number;
  team: number;
  scores: number[];
  attempts: number;
  status: "intro" | "question" | "wrong" | "correct" | "summary";
  choice: string | null;
};
export const initialSession = (): Session => ({
  index: 0,
  team: 0,
  scores: [0, 0, 0, 0],
  attempts: 0,
  status: "intro",
  choice: null,
});
export function answer(
  session: Session,
  correct: boolean,
  choice: string,
): Session {
  if (session.status !== "question") return session;
  const scores = [...session.scores];
  if (correct) scores[session.team] += session.attempts === 0 ? 10 : 5;
  return {
    ...session,
    scores,
    attempts: session.attempts + 1,
    choice,
    status: correct ? "correct" : "wrong",
  };
}
export function nextQuestion(
  session: Session,
  stageIndexes: number[],
): Session {
  if (session.status !== "correct") return session;
  const index = session.index + 1;
  return {
    ...session,
    index,
    team: (session.team + 1) % 4,
    attempts: 0,
    choice: null,
    status:
      index === stageIndexes.length
        ? "summary"
        : stageIndexes[index] !== stageIndexes[session.index]
          ? "intro"
          : "question",
  };
}

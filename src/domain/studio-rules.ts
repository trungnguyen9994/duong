import {
  letterKey,
  phraseKey,
  questionsOf,
  type StudioSpec,
} from "./studio-spec";

export type JourneySession = {
  index: number;
  team: number;
  scores: number[];
  attempts: number;
  phase: "intro" | "question" | "wrong" | "correct" | "summary";
  selected?: number;
};
export function initialJourney(spec: StudioSpec): JourneySession {
  return {
    index: 0,
    team: 0,
    scores: spec.settings.teams.map(() => 0),
    attempts: 0,
    phase: "intro",
  };
}
export function answerJourney(
  spec: StudioSpec,
  state: JourneySession,
  choice: number,
): JourneySession {
  if (spec.kind !== "journey" || state.phase !== "question") return state;
  const q = questionsOf(spec)[state.index];
  if (!q) return state;
  if (q.correct !== choice)
    return {
      ...state,
      phase: "wrong",
      attempts: state.attempts + 1,
      selected: choice,
    };
  let offset = 0;
  const stage = spec.content.stages.find((stage) => {
    offset += stage.questions.length;
    return state.index < offset;
  })!;
  const scores = [...state.scores];
  scores[state.team] +=
    (state.attempts ? spec.settings.pointsRetry : spec.settings.pointsFirst) *
    stage.multiplier;
  return { ...state, phase: "correct", selected: choice, scores };
}

export type PictureSession = {
  opened: number[];
  active: number | null;
  team: number;
  scores: number[];
  attempts: number;
  phase: "board" | "question" | "wrong" | "correct" | "summary";
  guessMessage: string;
};
export const initialPicture = (s: StudioSpec): PictureSession => ({
  opened: [],
  active: null,
  team: 0,
  scores: s.settings.teams.map(() => 0),
  attempts: 0,
  phase: "board",
  guessMessage: "",
});
export function selectTile(
  spec: StudioSpec,
  state: PictureSession,
  tile: number,
): PictureSession {
  if (
    spec.kind !== "picture_reveal" ||
    state.phase !== "board" ||
    state.opened.includes(tile) ||
    tile < 0 ||
    tile >= spec.content.size
  )
    return state;
  return {
    ...state,
    active: tile,
    attempts: 0,
    phase: "question",
    guessMessage: "",
  };
}
export function answerTile(
  spec: StudioSpec,
  state: PictureSession,
  choice: number,
): PictureSession {
  if (
    spec.kind !== "picture_reveal" ||
    state.phase !== "question" ||
    state.active === null
  )
    return state;
  if (spec.content.questions[state.active].correct !== choice)
    return { ...state, attempts: state.attempts + 1, phase: "wrong" };
  const scores = [...state.scores];
  scores[state.team] += state.attempts
    ? spec.settings.pointsRetry
    : spec.settings.pointsFirst;
  return {
    ...state,
    scores,
    opened: [...state.opened, state.active],
    phase: "correct",
  };
}
export function guessPicture(
  spec: StudioSpec,
  state: PictureSession,
  guess: string,
): PictureSession {
  if (
    spec.kind !== "picture_reveal" ||
    state.phase !== "board" ||
    (!spec.content.earlyGuess && state.opened.length < spec.content.size) ||
    !guess.trim()
  )
    return state;
  return phraseKey(guess) === phraseKey(spec.content.answer)
    ? {
        ...state,
        phase: "summary",
        guessMessage: "Chính xác! Cả lớp đã tìm ra bức tranh.",
      }
    : {
        ...state,
        team: (state.team + 1) % state.scores.length,
        guessMessage: "Chưa đúng, cùng khám phá thêm nhé!",
      };
}

export type WheelSession = {
  team: number;
  scores: number[];
  guessed: string[];
  segment: number | null;
  phase: "spin" | "letter" | "summary";
  message: string;
  log: string[];
};
export const initialWheel = (s: StudioSpec): WheelSession => ({
  team: 0,
  scores: s.settings.teams.map(() => 0),
  guessed: [],
  segment: null,
  phase: "spin",
  message: `Đến lượt quay của ${s.settings.teams[0]}!`,
  log: [],
});
export function spinWheel(
  spec: StudioSpec,
  state: WheelSession,
  index: number,
): WheelSession {
  if (
    spec.kind !== "word_wheel" ||
    state.phase !== "spin" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 7
  )
    return state;
  const value = spec.content.segments[index],
    lose = value === "lose_turn",
    message = `${spec.settings.teams[state.team]} quay được ${lose ? "mất lượt" : value + " điểm"}.`;
  return {
    ...state,
    segment: index,
    phase: lose ? "spin" : "letter",
    team: lose ? (state.team + 1) % state.scores.length : state.team,
    message,
    log: [...state.log, message],
  };
}
export function guessLetter(
  spec: StudioSpec,
  state: WheelSession,
  input: string,
): WheelSession {
  if (spec.kind !== "word_wheel" || state.phase !== "letter") return state;
  const key = letterKey(input.trim());
  if (Array.from(key).length !== 1 || !/^\p{L}$/u.test(key))
    return { ...state, message: "Chọn một chữ cái nhé." };
  if (state.guessed.includes(key))
    return { ...state, message: "Chữ này đã được đoán. Hãy chọn chữ khác." };
  const count = Array.from(spec.content.phrase.normalize("NFC")).filter(
      (c) => letterKey(c) === key,
    ).length,
    scores = [...state.scores];
  const value = spec.content.segments[state.segment!];
  if (count && typeof value === "number") scores[state.team] += count * value;
  const message = `${spec.settings.teams[state.team]} đoán ${key}: ${count ? `${count} chữ, +${typeof value === "number" ? count * value : 0} điểm` : "không có, chuyển lượt"}.`;
  return {
    ...state,
    scores,
    guessed: [...state.guessed, key],
    team: count ? state.team : (state.team + 1) % scores.length,
    phase: "spin",
    message,
    log: [...state.log, message],
  };
}
export function solveWheel(
  spec: StudioSpec,
  state: WheelSession,
  input: string,
): WheelSession {
  if (spec.kind !== "word_wheel" || state.phase === "summary" || !input.trim())
    return state;
  const correct = phraseKey(input) === phraseKey(spec.content.phrase),
    scores = [...state.scores];
  if (correct) scores[state.team] += 50;
  const message = `${spec.settings.teams[state.team]} giải cụm từ ${correct ? "chính xác! +50 điểm." : "chưa đúng, chuyển lượt."}`;
  return {
    ...state,
    scores,
    phase: correct ? "summary" : "spin",
    team: correct ? state.team : (state.team + 1) % scores.length,
    message,
    log: [...state.log, message],
  };
}
export function nextJourney(
  spec: StudioSpec,
  state: JourneySession,
): JourneySession {
  if (spec.kind !== "journey" || state.phase !== "correct") return state;
  const index = state.index + 1;
  const boundaries = spec.content.stages.map((_, i) =>
    spec.content.stages
      .slice(0, i + 1)
      .reduce((n, s) => n + s.questions.length, 0),
  );
  return {
    ...state,
    index,
    team: (state.team + 1) % state.scores.length,
    attempts: 0,
    selected: undefined,
    phase:
      index >= questionsOf(spec).length
        ? "summary"
        : boundaries.includes(index)
          ? "intro"
          : "question",
  };
}

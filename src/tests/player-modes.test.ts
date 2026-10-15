import { expect, it } from "vitest";
import { createStudioGame, studioSpecSchema } from "../domain/studio-spec";
import { initialWheel, spinWheel, guessLetter } from "../domain/studio-rules";

it("new games start with individual play, and old specs retain team mode", () => {
  const game = createStudioGame();
  expect(game.settings.playMode).toBe("individual");
  const old = structuredClone(game) as unknown as { settings: Record<string, unknown> };
  delete old.settings.playMode;
  expect(studioSpecSchema.parse(old).settings.playMode).toBe("teams");
});

it("keeps scores for a class of 50 and credits the called student only", () => {
  const game = createStudioGame("word_wheel");
  if (game.kind !== "word_wheel") throw Error();
  game.settings.teams = Array.from({length:50}, (_,i)=>`Học sinh ${i+1}`);
  game.content.phrase = "CÁNH DIỀU";
  expect(studioSpecSchema.safeParse(game).success).toBe(true);
  let state = {...initialWheel(game), team: 49};
  state = spinWheel(game, state, 0);
  state = guessLetter(game, state, "C");
  expect(state.scores[49]).toBe(10);
  expect(state.scores.slice(0,49).every(score=>score===0)).toBe(true);
  state = spinWheel(game, state, 7);
  expect(state.team).toBe(0);
  expect(state.scores[49]).toBe(10);
});

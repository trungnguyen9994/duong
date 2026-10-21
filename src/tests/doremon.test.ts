import { describe, it, expect } from "vitest";
import {
  createStudioGame,
  playableErrors,
  studioSpecSchema,
} from "../domain/studio-spec";
import {
  initialAdventure,
  chooseAdventure,
  answerAdventure,
  nextAdventure,
} from "../domain/adventure-rules";
import { renderPptx } from "../../server/pptx";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";

describe("Du lịch cùng Doremon", () => {
  it("validates four destinations, two options, retries and completion", () => {
    const spec = createStudioGame("doremon_travel");
    expect(studioSpecSchema.safeParse(spec).success).toBe(true);
    expect(playableErrors(spec)).toEqual([]);
    if (spec.kind !== "doremon_travel") throw Error();
    let state = initialAdventure(spec);
    state = chooseAdventure(spec, state, 0);
    expect(answerAdventure(spec, state, 2)).toEqual(state);
    state = answerAdventure(spec, state, 1 - spec.content.questions[0].correct);
    expect(state.phase).toBe("wrong");
    state = { ...state, phase: "question" };
    state = answerAdventure(spec, state, spec.content.questions[0].correct);
    expect(state.scores[0]).toBe(spec.settings.pointsRetry);
    state = nextAdventure(spec, state);
    for (let i = 1; i < 4; i++) {
      state = chooseAdventure(spec, state, i);
      state = answerAdventure(spec, state, spec.content.questions[i].correct);
      state = nextAdventure(spec, state);
    }
    expect(state.phase).toBe("summary");
    expect(state.completed).toEqual([0, 1, 2, 3]);
    spec.content.questions.pop();
    expect(playableErrors(spec).join(" ")).toContain("bốn điểm đến");
  });
  it("keeps native animations and all audio bytes while translating the deck", async () => {
    const spec = createStudioGame("doremon_travel");
    if (spec.kind !== "doremon_travel") throw Error();
    spec.content.questions[0].correct = 0;
    const output = await JSZip.loadAsync(await renderPptx(spec, new Map()));
    const original = await JSZip.loadAsync(
      await readFile("server/templates/doremon_travel.pptx"),
    );
    for (const name of Object.keys(original.files).filter((n) =>
      /ppt\/media\/audio\d+\.wav$/.test(n),
    )) {
      expect(await output.file(name)!.async("nodebuffer")).toEqual(
        await original.file(name)!.async("nodebuffer"),
      );
    }
    for (let i = 1; i <= 5; i++) {
      const xml = await output
        .file(`ppt/slides/slide${i}.xml`)!
        .async("string");
      expect(xml).not.toMatch(
        /Travelling|Question|Danang Vietnam|\. right|\. wrong/,
      );
      expect(xml).toContain("<p:timing>");
      if (i > 1) expect(xml).toContain("Chính xác!");
    }
    const slide = await output.file("ppt/slides/slide2.xml")!.async("string");
    const before = await original
      .file("ppt/slides/slide2.xml")!
      .async("string");
    const clicks = (s: string) =>
      [...s.matchAll(/<p:cond\b[^>]*evt="onClick"[\s\S]*?<\/p:cond>/g)].map(
        (m) => m[0].match(/spid="(\d+)"/)![1],
      );
    expect(clicks(slide)).toEqual(
      clicks(before).map((id) => (id === "8" ? "15" : id === "15" ? "8" : id)),
    );
  }, 30000);
});

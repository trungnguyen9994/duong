import { it, expect } from "vitest";
import JSZip from "jszip";
import {
  createStudioGame,
  playableErrors,
  studioSpecSchema,
} from "../domain/studio-spec";
import { initialFrog, selectFrog, markFrog } from "../domain/frog-rules";
import { getTemplate } from "../domain/template-registry";
import { frogSlides, renderPptx } from "../../server/pptx";
function example() {
  const spec = createStudioGame("clever_frog");
  if (spec.kind !== "clever_frog") throw Error();
  spec.content.questions.forEach((q, i) => {
    q.prompt = `${i + 1} × 3 = ?`;
    q.choices[0] = String((i + 1) * 3);
  });
  return spec;
}
it("validates oral answers and registers the correct editor schema", () => {
  const spec = example();
  expect(playableErrors(spec)).toEqual([]);
  expect(studioSpecSchema.safeParse(spec).success).toBe(true);
  expect(getTemplate("clever_frog", 1).editorSchema.fields).toEqual([
    "questions",
  ]);
  spec.content.questions[0].choices[0] = "";
  expect(playableErrors(spec)).toContain(
    "Hoàn thiện câu hỏi và đáp án của từng chú ếch.",
  );
});
it("allows arbitrary selection and scores each frog once with retry points", () => {
  const spec = example();
  spec.settings.teams = ["A", "B"];
  let state = initialFrog(spec);
  expect(markFrog(spec, state, true)).toBe(state);
  state = selectFrog(spec, state, 7);
  expect(state.active).toBe(7);
  state = markFrog(spec, { ...state, phase: "answer", attempts: 1 }, true);
  expect(state.scores).toEqual([5, 0]);
  expect(state.team).toBe(1);
  expect(selectFrog(spec, state, 7)).toBe(state);
  for (let i = 0; i < 10; i++) {
    if (i === 7) continue;
    state = selectFrog(spec, state, i);
    state = markFrog(spec, { ...state, phase: "answer" }, false);
  }
  expect(state.phase).toBe("summary");
  expect(markFrog(spec, state, true)).toBe(state);
});
it("exports the pond, ten returning question shows and offline triggered answers", async () => {
  const spec = example();
  const nodes = frogSlides(spec);
  expect(nodes).toHaveLength(13);
  const ids = new Set(nodes.map((n) => n.id));
  for (const node of nodes)
    for (const button of node.buttons)
      expect(ids.has(button.target)).toBe(true);
  const zip = await JSZip.loadAsync(await renderPptx(spec, new Map()));
  const board = await zip.file("ppt/slides/slide2.xml")!.async("string");
  expect(board).toContain("Chăm Chỉ");
  expect([...board.matchAll(/action="ppaction:\/\/hlinksldjump"/g)]).toHaveLength(10);
  expect(board).toContain('nodeType="interactiveSeq"');
  const question = await zip.file("ppt/slides/slide3.xml")!.async("string");
  expect(question).toContain("Đáp án: 3");
  expect(question).toContain("ppaction://hlinksldjump");
  expect(question).toContain('presetClass="entr"');
}, 30000);

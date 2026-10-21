import { it, expect } from "vitest";
import JSZip from "jszip";
import { adventureTypes, adventureConfig } from "../domain/adventure-config";
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
import { renderPptx, deckSlides } from "../../server/pptx";
import { getTemplate } from "../domain/template-registry";
function example(type: (typeof adventureTypes)[number]) {
  const spec = createStudioGame(type);
  if (!("questions" in spec.content)) throw Error();
  spec.content.questions.forEach((q, i) => {
    q.prompt = `${i + 1} + 2 = ?`;
    q.choices = [String(i + 3), "0", "1", type === "boat_rescue" ? "" : "2"];
    q.correct = 0;
  });
  return spec;
}
it.each(adventureTypes)(
  "%s validates, retries and completes without awarding points twice",
  (type) => {
    const spec = example(type);
    expect(playableErrors(spec)).toEqual([]);
    expect(studioSpecSchema.safeParse(spec).success).toBe(true);
    expect(getTemplate(type, 1).editorSchema.fields).toEqual(["questions"]);
    let state = initialAdventure(spec);
    if (type !== "football") state = chooseAdventure(spec, state, 0);
    if (type === "forest_rescue") state = { ...state, phase: "answer" };
    state = answerAdventure(spec, state, type === "forest_rescue" ? false : 1);
    expect(state.phase).toBe("wrong");
    expect(state.scores).toEqual([0]);
    state = {
      ...state,
      phase: type === "forest_rescue" ? "answer" : "question",
    };
    state = answerAdventure(spec, state, type === "forest_rescue" ? true : 0);
    expect(state.scores).toEqual([5]);
    expect(answerAdventure(spec, state, 0)).toBe(state);
    state = nextAdventure(spec, state);
    if (type !== "football")
      expect(chooseAdventure(spec, state, 0)).toBe(state);
    for (
      let i = 1;
      i < ("questions" in spec.content ? spec.content.questions.length : 0);
      i++
    ) {
      if (type !== "football") state = chooseAdventure(spec, state, i);
      if (type === "forest_rescue") state = { ...state, phase: "answer" };
      state = answerAdventure(spec, state, type === "forest_rescue" ? true : 0);
      state = nextAdventure(spec, state);
    }
    expect(state.phase).toBe("summary");
  },
);
it.each(adventureTypes)(
  "%s exports editable questions with native animation and valid shape IDs",
  async (type) => {
    const spec = example(type),
      nodes = deckSlides(spec),
      zip = await JSZip.loadAsync(await renderPptx(spec, new Map()));
    const question = await zip
      .file(`ppt/slides/slide${type === "football" || type === "doremon_travel" ? 2 : 3}.xml`)!
      .async("string");
    expect(question).toContain("1 + 2 = ?");
    expect(question).toContain("<p:timing>");
    if(type === "football") expect(question).toContain("<p:animMotion");
    else expect(await zip.file("ppt/slides/slide2.xml")!.async("string")).toContain("<p:animMotion");
    if(type !== "forest_rescue") {
      expect(question).toContain('nodeType="interactiveSeq"');
      for(const letter of "ABCD".slice(0, adventureConfig[type].choices)) expect(question).toContain(`${letter}. `);
    }
    for (const path of Object.keys(zip.files).filter((p) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(p),
    )) {
      const xml = await zip.file(path)!.async("string");
      const objectIds = [...xml.matchAll(/<p:cNvPr\b[^>]*id="(\d+)"/g)].map(
        (m) => m[1],
      );
      for (const match of xml.matchAll(/<p:spTgt spid="(\d+)"/g))
        expect(objectIds).toContain(match[1]);
      const ids = [...xml.matchAll(/<p:cTn id="(\d+)"/g)].map((m) => m[1]);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(
      Object.keys(zip.files).filter((p) =>
        /^ppt\/slides\/slide\d+\.xml$/.test(p),
      ),
    ).toHaveLength(type === "doremon_travel" ? 5 : nodes.length - 1);
    spec.settings.reducedMotion = true;
    const reduced = await JSZip.loadAsync(await renderPptx(spec, new Map()));
    const quiet = await reduced
      .file(`ppt/slides/slide${type === "football" ? 2 : 3}.xml`)!
      .async("string");
    expect(quiet).not.toContain("<p:animMotion");
    expect(quiet).toContain('<p:timing>');
  },
  30000,
);

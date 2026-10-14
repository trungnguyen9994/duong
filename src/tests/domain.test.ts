import { describe, expect, it } from "vitest";
import { reserveQuestions, sampleGame } from "../domain/sample";
import {
  createGame,
  draftSpecSchema,
  gameSpecSchema,
  newQuestion,
} from "../domain/game-spec";
import { answer, initialSession, nextQuestion } from "../domain/rules";
import { compileSlideGraph } from "../features/export-pptx/slide-graph";
import { usedAssetIds } from "../domain/appearance";

describe("GameSpec", () => {
  it("opens legacy JSON without appearance fields", () => {
    const spec = sampleGame();
    spec.stages.forEach((s) => {
      delete s.backgroundTheme;
    });
    delete spec.config.character;
    delete spec.config.welcomeText;
    delete spec.config.narrationEnabled;
    expect(gameSpecSchema.safeParse(spec).success).toBe(true);
  });
  it("rejects a missing background asset", () => {
    const spec = sampleGame();
    spec.stages[0].backgroundAssetId = "missing";
    expect(gameSpecSchema.safeParse(spec).success).toBe(false);
  });
  it("keeps stage background references when question images are removed", () => {
    const spec = sampleGame();
    spec.stages[0].backgroundAssetId = "bg";
    spec.questions[0].imageAssetId = "question-img";
    expect([...usedAssetIds(spec)]).toContain("bg");
    delete spec.questions[0].imageAssetId;
    expect([...usedAssetIds(spec)]).toEqual(["bg"]);
  });
  it("restores incomplete backups without allowing them to play or export", () => {
    const draft = createGame();
    const q = newQuestion();
    draft.questions.push(q);
    draft.stages[0].questionIds.push(q.id);
    expect(draftSpecSchema.parse(JSON.parse(JSON.stringify(draft)))).toEqual(
      draft,
    );
    expect(gameSpecSchema.safeParse(draft).success).toBe(false);
  });
  it("accepts all eight reserve questions without changing the default twelve", () => {
    const spec = sampleGame();
    const reserve = reserveQuestions();
    spec.questions.push(...reserve);
    spec.stages[3].questionIds.push(...reserve.map((q) => q.id));
    expect(reserve).toHaveLength(8);
    expect(gameSpecSchema.safeParse(spec).success).toBe(true);
  });
  it("preserves question IDs and answers through JSON backup", () => {
    const spec = sampleGame();
    expect(gameSpecSchema.parse(JSON.parse(JSON.stringify(spec)))).toEqual(
      spec,
    );
    expect(spec.stages.map((s) => s.questionIds.length)).toEqual([2, 4, 4, 2]);
  });
  it.each([
    "missing-correct",
    "duplicate-question",
    "empty-stage",
    "unknown-reference",
    "duplicate-assignment",
    "unknown-asset",
    "unsupported-question",
    "external-asset",
  ])("rejects %s", (kind) => {
    const spec = sampleGame();
    if (kind === "missing-correct")
      spec.questions[0].correctChoiceId = "unknown";
    if (kind === "duplicate-question")
      spec.questions[1].id = spec.questions[0].id;
    if (kind === "empty-stage") spec.stages[0].questionIds = [];
    if (kind === "unknown-reference") spec.stages[0].questionIds[0] = "unknown";
    if (kind === "duplicate-assignment")
      spec.stages[1].questionIds.push(spec.questions[0].id);
    if (kind === "unknown-asset") spec.questions[0].imageAssetId = "unknown";
    if (kind === "unsupported-question")
      (spec.questions[0] as { type: string }).type = "drag-drop";
    if (kind === "external-asset")
      spec.assets.push({
        id: "asset",
        mime: "image/png",
        dataUrl: "https://example.com/a.png",
      });
    expect(gameSpecSchema.safeParse(spec).success).toBe(false);
  });
});
describe("Web scoring", () => {
  it("awards 10 once to the selected team and ignores further clicks", () => {
    const session = {
      ...initialSession(),
      status: "question" as const,
      team: 2,
    };
    const result = answer(session, true, "C");
    expect(result.scores).toEqual([0, 0, 10, 0]);
    expect(answer(result, true, "C")).toEqual(result);
  });
  it("awards 5 after any number of wrong attempts", () => {
    let s = { ...initialSession(), status: "question" as const };
    const wrong = answer(s, false, "A");
    expect(wrong.scores).toEqual([0, 0, 0, 0]);
    const wrongAgain = answer({ ...wrong, status: "question" }, false, "B");
    expect(
      answer({ ...wrongAgain, status: "question" }, true, "C").scores[0],
    ).toBe(5);
  });
  it("rotates teams, introduces new stages and reaches summary after question 12", () => {
    const stages = [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3];
    let session = initialSession();
    for (let i = 0; i < 12; i++) {
      session = nextQuestion(
        answer({ ...session, status: "question" }, true, "C"),
        stages,
      );
      if (i === 1) expect(session.status).toBe("intro");
    }
    expect(session.status).toBe("summary");
    expect(session.scores).toEqual([30, 30, 30, 30]);
  });
});
describe("PowerPoint navigation", () => {
  it("contains 44 slides and routes every choice, retry and next correctly", () => {
    const spec = sampleGame();
    const nodes = compileSlideGraph(spec);
    expect(nodes).toHaveLength(44);
    for (const stage of spec.stages)
      for (const id of stage.questionIds) {
        const q = spec.questions.find((q) => q.id === id)!;
        const node = nodes.find((n) => n.id === `q-${id}`)!;
        expect(node.links).toHaveLength(4);
        node.links.forEach((link) =>
          expect(link.target).toBe(
            `${link.choiceId === q.correctChoiceId ? "correct" : "wrong"}-${id}`,
          ),
        );
        expect(nodes.find((n) => n.id === `wrong-${id}`)!.links[0].target).toBe(
          `q-${id}`,
        );
      }
    expect(
      nodes.find((n) => n.id === `correct-${spec.stages[0].questionIds[1]}`)!
        .links[0].target,
    ).toBe("stage-1");
    expect(
      nodes.find((n) => n.id === `correct-${spec.stages[3].questionIds[1]}`)!
        .links[0].target,
    ).toBe("summary");
  });
});

import { gameSpecSchema, type GameSpec } from "../../domain/game-spec";
export type SlideNode = {
  id: string;
  kind:
    | "cover"
    | "instructions"
    | "map"
    | "stage"
    | "question"
    | "correct"
    | "wrong"
    | "summary";
  stageIndex?: number;
  questionId?: string;
  links: { label: string; target: string; choiceId?: string }[];
};
export function compileSlideGraph(input: GameSpec): SlideNode[] {
  const spec = gameSpecSchema.parse(input);
  const nodes: SlideNode[] = [
    {
      id: "cover",
      kind: "cover",
      links: [{ label: "Bắt đầu", target: "instructions" }],
    },
    {
      id: "instructions",
      kind: "instructions",
      links: [{ label: "Đến bản đồ", target: "map" }],
    },
    {
      id: "map",
      kind: "map",
      links: spec.stages.map((s, i) => ({
        label: s.title,
        target: `stage-${i}`,
      })),
    },
  ];
  spec.stages.forEach((stage, stageIndex) => {
    nodes.push({
      id: `stage-${stageIndex}`,
      kind: "stage",
      stageIndex,
      links: [{ label: "Bắt đầu chặng", target: `q-${stage.questionIds[0]}` }],
    });
    stage.questionIds.forEach((id, i) => {
      const q = spec.questions.find((q) => q.id === id)!;
      const next = stage.questionIds[i + 1]
        ? `q-${stage.questionIds[i + 1]}`
        : stageIndex < 3
          ? `stage-${stageIndex + 1}`
          : "summary";
      nodes.push(
        {
          id: `q-${id}`,
          kind: "question",
          stageIndex,
          questionId: id,
          links: q.choices.map((c) => ({
            label: c.text,
            choiceId: c.id,
            target: `${c.id === q.correctChoiceId ? "correct" : "wrong"}-${id}`,
          })),
        },
        {
          id: `correct-${id}`,
          kind: "correct",
          stageIndex,
          questionId: id,
          links: [
            {
              label: next === "summary" ? "Hoàn thành" : "Tiếp tục",
              target: next,
            },
          ],
        },
        {
          id: `wrong-${id}`,
          kind: "wrong",
          stageIndex,
          questionId: id,
          links: [{ label: "Thử lại", target: `q-${id}` }],
        },
      );
    });
  });
  nodes.push({
    id: "summary",
    kind: "summary",
    links: [
      { label: "Chơi lại", target: "cover" },
      { label: "Về bản đồ", target: "map" },
    ],
  });
  assertEveryLinkResolves(nodes);
  return nodes;
}
export function assertEveryLinkResolves(nodes: SlideNode[]) {
  const ids = new Set(nodes.map((n) => n.id));
  if (ids.size !== nodes.length) throw new Error("Định danh slide bị trùng");
  for (const node of nodes)
    for (const link of node.links)
      if (!ids.has(link.target))
        throw new Error(`Liên kết không tồn tại: ${link.target}`);
}

import { draftSpecSchema, type GameSpec } from "./game-spec";
import { createStudioGame, type StudioSpec } from "./studio-spec";

/** Never mutates or removes the source. Asset upload must use the signed-in owner's API. */
export async function migrateLegacy(
  input: unknown,
  upload: (dataUrl: string) => Promise<string>,
): Promise<StudioSpec> {
  const old: GameSpec = draftSpecSchema.parse(input);
  const assets = new Map<string, string>();
  for (const asset of old.assets)
    assets.set(asset.id, await upload(asset.dataUrl));
  const spec = createStudioGame("journey");
  if (spec.kind !== "journey") throw new Error("Sai mẫu chuyển đổi.");
  spec.metadata = {
    title: old.title,
    description: old.description,
    subjectId: "math",
    grade: 3,
  };
  spec.settings = {
    ...spec.settings,
    playMode: "teams",
    teams: ["Đội Sao", "Đội Mặt Trời", "Đội Cầu Vồng", "Đội Ngôi Sao"],
    timerSeconds: old.config.timerSeconds,
    pointsFirst: old.config.pointsFirst,
    pointsRetry: old.config.pointsRetry,
    muted: !old.config.narrationEnabled,
  };
  spec.content.stages = old.stages.map((stage) => ({
    id: crypto.randomUUID(),
    title: stage.title,
    backgroundId: stage.backgroundAssetId
      ? assets.get(stage.backgroundAssetId)
      : undefined,
    multiplier: 1,
    questions: stage.questionIds.map((id) => {
      const q = old.questions.find((q) => q.id === id)!;
      return {
        id: crypto.randomUUID(),
        prompt: q.prompt,
        choices: q.choices.map((c) => c.text),
        correct: q.choices.findIndex((c) => c.id === q.correctChoiceId),
        hint: q.hint,
        explanation: q.explanation || "",
        ...(q.imageAssetId ? { imageId: assets.get(q.imageAssetId) } : {}),
      };
    }),
  }));
  spec.media.backgroundId = old.stages[0].backgroundAssetId
    ? assets.get(old.stages[0].backgroundAssetId)
    : undefined;
  return spec;
}

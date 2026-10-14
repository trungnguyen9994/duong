import { z } from "zod";

const nonempty = z.string().trim().min(1, "Không được để trống");
const choiceSchema = z.object({
  id: nonempty,
  text: nonempty.max(180, "Đáp án tối đa 180 ký tự"),
});
const questionSchema = z.object({
  id: nonempty,
  type: z.literal("single-choice"),
  prompt: nonempty.max(400, "Đề bài tối đa 400 ký tự"),
  choices: z.array(choiceSchema).length(4, "Cần đúng 4 phương án"),
  correctChoiceId: nonempty,
  hint: nonempty.max(300, "Gợi ý tối đa 300 ký tự"),
  explanation: z.string().max(500).optional(),
  imageAssetId: z.string().optional(),
});
const stageSchema = z.object({
  id: nonempty,
  title: nonempty.max(70),
  questionIds: z.array(nonempty).min(1, "Chặng cần ít nhất một câu"),
  backgroundTheme: z.enum(["forest", "mountain", "cave", "castle"]).optional(),
  backgroundAssetId: z.string().optional(),
  introText: z.string().max(300).optional(),
});
const gameSpecBaseSchema = z.object({
  schemaVersion: z.literal("1.0"),
  id: nonempty,
  title: nonempty.max(120),
  description: z.string().max(600).default(""),
  subject: z.literal("math"),
  grade: z.literal(3),
  theme: z.literal("rescue"),
  curriculum: z.literal("canh-dieu").optional(),
  stages: z.array(stageSchema).length(4, "Cần đúng 4 chặng"),
  questions: z.array(questionSchema),
  assets: z.array(
    z.object({
      id: nonempty,
      mime: z.enum(["image/png", "image/jpeg"]),
      dataUrl: nonempty,
    }),
  ),
  config: z.object({
    pointsFirst: z.literal(10),
    pointsRetry: z.literal(5),
    timerSeconds: z.number().int().min(0).max(300),
    character: z.enum(["explorer", "star", "dragon"]).optional(),
    welcomeText: z.string().max(300).optional(),
    narrationEnabled: z.boolean().optional(),
  }),
});
export type GameSpec = z.infer<typeof gameSpecBaseSchema>;
function checkIntegrity(spec: GameSpec, ctx: z.RefinementCtx) {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });
  for (const key of ["stages", "questions", "assets"] as const) {
    const ids = new Set<string>();
    spec[key].forEach((item, i) => {
      if (ids.has(item.id)) issue([key, i, "id"], "ID bị trùng");
      ids.add(item.id);
    });
  }
  const assigned = new Set<string>();
  spec.stages.forEach((stage, i) => {
    if (
      stage.backgroundAssetId &&
      !spec.assets.some((a) => a.id === stage.backgroundAssetId)
    )
      issue(["stages", i, "backgroundAssetId"], "Thiếu ảnh nền của chặng");
  });
  spec.stages.forEach((stage, i) =>
    stage.questionIds.forEach((id) => {
      if (!spec.questions.some((q) => q.id === id))
        issue(["stages", i, "questionIds"], "Tham chiếu câu hỏi không tồn tại");
      if (assigned.has(id))
        issue(["stages", i, "questionIds"], "Câu hỏi xuất hiện nhiều lần");
      assigned.add(id);
    }),
  );
  spec.questions.forEach((q, i) => {
    if (!assigned.has(q.id))
      issue(["questions", i], "Câu hỏi chưa được xếp vào chặng");
    if (new Set(q.choices.map((c) => c.id)).size !== 4)
      issue(["questions", i, "choices"], "ID phương án bị trùng");
    if (!q.choices.some((c) => c.id === q.correctChoiceId))
      issue(["questions", i, "correctChoiceId"], "Chọn một đáp án đúng");
    if (q.imageAssetId && !spec.assets.some((a) => a.id === q.imageAssetId))
      issue(["questions", i, "imageAssetId"], "Thiếu hình minh họa");
  });
  spec.assets.forEach((a, i) => {
    const prefix = `data:${a.mime};base64,`;
    if (
      !a.dataUrl.startsWith(prefix) ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(a.dataUrl.slice(prefix.length))
    )
      issue(["assets", i], "Ảnh cần được nhúng dưới dạng PNG/JPEG hợp lệ");
    if (a.dataUrl.length > 4_200_000)
      issue(["assets", i], "Ảnh quá lớn, hãy dùng ảnh dưới 3 MB");
  });
}
export const gameSpecSchema = gameSpecBaseSchema.superRefine(checkIntegrity);
// Backups can contain work in progress, while identity and asset references stay valid.
export const draftSpecSchema = gameSpecBaseSchema
  .extend({
    title: z.string().max(120),
    stages: z
      .array(
        stageSchema.extend({
          title: z.string().max(70),
          questionIds: z.array(nonempty),
        }),
      )
      .length(4),
    questions: z.array(
      questionSchema.extend({
        prompt: z.string().max(400),
        hint: z.string().max(300),
        choices: z
          .array(choiceSchema.extend({ text: z.string().max(180) }))
          .length(4),
      }),
    ),
  })
  .superRefine(checkIntegrity);
export type Question = GameSpec["questions"][number];
export const uid = () => crypto.randomUUID();
export function newQuestion(): Question {
  return {
    id: uid(),
    type: "single-choice",
    prompt: "",
    choices: ["A", "B", "C", "D"].map((id) => ({ id, text: "" })),
    correctChoiceId: "A",
    hint: "",
    explanation: "",
  };
}
export function createGame(): GameSpec {
  return {
    schemaVersion: "1.0",
    id: uid(),
    title: "Trò chơi mới",
    description: "",
    subject: "math",
    grade: 3,
    theme: "rescue",
    stages: [
      "Rừng Khởi động",
      "Núi Phép tính",
      "Hang Bí mật",
      "Lâu đài Về đích",
    ].map((title, i) => ({
      id: uid(),
      title,
      questionIds: [],
      backgroundTheme: (["forest", "mountain", "cave", "castle"] as const)[i],
    })),
    questions: [],
    assets: [],
    config: {
      pointsFirst: 10,
      pointsRetry: 5,
      timerSeconds: 45,
      character: "explorer",
      narrationEnabled: true,
      welcomeText:
        "Xin chào! Mình là Bé Sao. Cùng mình tìm những mảnh chìa khóa và giải cứu vương quốc Toán học nhé!",
    },
  };
}
export function orderedQuestions(spec: GameSpec) {
  return spec.stages.flatMap((stage, stageIndex) =>
    stage.questionIds.map((id) => ({
      stage,
      stageIndex,
      question: spec.questions.find((q) => q.id === id)!,
    })),
  );
}
export function errorsFor(spec: GameSpec) {
  const result = gameSpecSchema.safeParse(spec);
  return result.success
    ? []
    : result.error.issues.map((i) => ({ path: i.path, message: i.message }));
}

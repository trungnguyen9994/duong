import { z } from "zod";

export const templateTypes = [
  "journey",
  "picture_reveal",
  "word_wheel",
] as const;
export const mcqSchema = z.object({
  id: z.string().uuid(),
  prompt: z.string().max(400),
  choices: z.array(z.string().max(180)).length(4),
  correct: z.number().int().min(0).max(3),
  hint: z.string().max(300).default(""),
  explanation: z.string().max(500).default(""),
  imageId: z.string().uuid().optional(),
  sourceQuestionId: z.string().uuid().optional(),
});
const stage = z.object({
  id: z.string().uuid(),
  title: z.string().max(70),
  backgroundId: z.string().uuid().optional(),
  multiplier: z.number().min(1).max(10).default(1),
  questions: z.array(mcqSchema).max(12),
});
const common = {
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  metadata: z.object({
    title: z.string().max(120),
    description: z.string().max(600).default(""),
    subjectId: z.string().max(40),
    grade: z.number().int().min(1).max(5),
  }),
  settings: z.object({
    playMode: z.enum(["individual", "teams"]).default("teams"),
    teams: z.array(z.string().max(40)).min(1).max(50),
    timerSeconds: z.number().int().min(0).max(300),
    pointsFirst: z.number().int().min(0).max(100),
    pointsRetry: z.number().int().min(0).max(100),
    muted: z.boolean(),
    reducedMotion: z.boolean(),
  }),
  media: z.object({
    backgroundId: z.string().uuid().optional(),
    characterId: z.string().uuid().optional(),
    fit: z.enum(["cover", "contain"]),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    zoom: z.number().min(1).max(3),
    opacity: z.number().min(0).max(1),
    alt: z.string().max(300),
  }),
};
export const studioSpecSchema = z.discriminatedUnion("kind", [
  z.object({
    ...common,
    kind: z.literal("journey"),
    template: z.object({ type: z.literal("journey"), version: z.literal(1) }),
    content: z.object({ stages: z.array(stage).length(4) }),
  }),
  z.object({
    ...common,
    kind: z.literal("picture_reveal"),
    template: z.object({
      type: z.literal("picture_reveal"),
      version: z.literal(1),
    }),
    content: z.object({
      size: z.union([z.literal(4), z.literal(6), z.literal(9)]),
      imageId: z.string().uuid().optional(),
      answer: z.string().max(150),
      earlyGuess: z.boolean(),
      questions: z.array(mcqSchema).max(9),
    }),
  }),
  z.object({
    ...common,
    kind: z.literal("word_wheel"),
    template: z.object({
      type: z.literal("word_wheel"),
      version: z.literal(1),
    }),
    content: z.object({
      phrase: z.string().max(80),
      clue: z.string().max(400),
      segments: z.tuple([
        z.literal(10),
        z.literal(20),
        z.literal(30),
        z.literal(40),
        z.literal(10),
        z.literal(20),
        z.literal(30),
        z.literal("lose_turn"),
      ]),
    }),
  }),
]);
export type StudioSpec = z.infer<typeof studioSpecSchema>;
export type Mcq = z.infer<typeof mcqSchema>;
export type TemplateType = (typeof templateTypes)[number];

export function createStudioGame(type: TemplateType = "journey"): StudioSpec {
  const base = {
    schemaVersion: 1 as const,
    id: crypto.randomUUID(),
    metadata: {
      title: "Trò chơi mới",
      description: "",
      subjectId: "math",
      grade: 3,
    },
    settings: {
      playMode: "individual" as const,
      teams: ["Học sinh 1"],
      timerSeconds: 45,
      pointsFirst: 10,
      pointsRetry: 5,
      muted: false,
      reducedMotion: false,
    },
    media: {
      fit: "cover" as const,
      x: 50,
      y: 50,
      zoom: 1,
      opacity: 1,
      alt: "",
    },
  };
  if (type === "picture_reveal")
    return {
      ...base,
      kind: type,
      template: { type, version: 1 },
      content: { size: 6, answer: "", earlyGuess: true, questions: [] },
    };
  if (type === "word_wheel")
    return {
      ...base,
      kind: type,
      template: { type, version: 1 },
      content: {
        phrase: "",
        clue: "",
        segments: [10, 20, 30, 40, 10, 20, 30, "lose_turn"],
      },
    };
  return {
    ...base,
    kind: type,
    template: { type, version: 1 },
    content: {
      stages: ["Khởi động", "Vượt thác", "Hang động", "Về đích"].map(
        (title) => ({
          id: crypto.randomUUID(),
          title,
          multiplier: 1,
          questions: [],
        }),
      ),
    },
  };
}

export function questionsOf(spec: StudioSpec): Mcq[] {
  return spec.kind === "journey"
    ? spec.content.stages.flatMap((s) => s.questions)
    : spec.kind === "picture_reveal"
      ? spec.content.questions
      : [];
}
export function assetIds(spec: StudioSpec): string[] {
  return [
    ...new Set(
      [
        spec.media.backgroundId,
        spec.media.characterId,
        ...(spec.kind === "journey"
          ? spec.content.stages.map((s) => s.backgroundId)
          : []),
        spec.kind === "picture_reveal" ? spec.content.imageId : undefined,
        ...questionsOf(spec).map((q) => q.imageId),
      ].filter((id): id is string => !!id),
    ),
  ];
}
export function playableErrors(input: unknown): string[] {
  const parsed = studioSpecSchema.safeParse(input);
  if (!parsed.success)
    return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const s = parsed.data,
    errors: string[] = [];
  if (!s.metadata.title.trim()) errors.push("Cần tên trò chơi.");
  if (s.settings.teams.some(name => !name.trim())) errors.push("Cần nhập tên cho từng học sinh hoặc tổ / đội.");
  if (new Set(s.settings.teams.map(name => name.trim().normalize("NFC").toLocaleLowerCase("vi"))).size !== s.settings.teams.length)
    errors.push("Tên người chơi bị trùng; thêm số thứ tự hoặc tên phân biệt.");
  if (
    s.kind === "journey" &&
    s.content.stages.some((stage) => !stage.questions.length)
  )
    errors.push("Mỗi chặng cần ít nhất một câu hỏi.");
  if (
    s.kind === "picture_reveal" &&
    (s.content.questions.length !== s.content.size ||
      !s.content.imageId ||
      !s.content.answer.trim())
  )
    errors.push("Cần ảnh bí mật, đáp án và một câu cho mỗi ô.");
  if (s.kind === "word_wheel" && !s.content.phrase.trim())
    errors.push("Cần cụm từ bí mật.");
  const questions = questionsOf(s);
  if (new Set(questions.map((q) => q.id)).size !== questions.length)
    errors.push("ID câu hỏi bị trùng.");
  if (
    questions.some((q) => !q.prompt.trim() || q.choices.some((c) => !c.trim()))
  )
    errors.push("Hoàn thiện đề bài và bốn lựa chọn.");
  return errors;
}

export const templateRegistry = Object.freeze({
  journey: Object.freeze({
    version: 1,
    name: "Hành trình tri thức",
    image: "/art/forest.png",
    released: true,
    pptx: "Nhánh đúng/sai/thử lại; giáo viên quản lý điểm và thời gian.",
  }),
  picture_reveal: Object.freeze({
    version: 1,
    name: "Mảnh ghép bí mật",
    image: "/art/castle.png",
    released: true,
    pptx: "Mở ô theo thứ tự từ trái sang phải, trên xuống dưới.",
  }),
  word_wheel: Object.freeze({
    version: 1,
    name: "Vòng quay ô chữ",
    image: "/art/mountain.png",
    released: true,
    pptx: "Mở chữ theo kịch bản; quay và ghi điểm thủ công.",
  }),
});

// Remove Vietnamese tone marks only; keep vowel-shape marks and Đ distinct.
export const letterKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300\u0301\u0303\u0309\u0323]/g, "")
    .normalize("NFC")
    .toLocaleUpperCase("vi");
export const phraseKey = (value: string) =>
  value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleUpperCase("vi");

// Convert the public-slide inspection to the bank's single-answer MCQ format.
// Do not synthesize distractors, explanations, or missing image context.
import { readFile, writeFile } from "node:fs/promises";
import { reviewIssue } from "./edulive-review.mjs";

const grade = Number(process.argv[2] || 3);
if (![1, 2, 3].includes(grade))
  throw new Error("Usage: node scripts/import-edulive-questions.mjs [1|2|3]");
const report = JSON.parse(
  await readFile(
    new URL(
      grade === 3
        ? "../data/edulive-inspection.json"
        : `../data/edulive-inspection-grade${grade}-volume2.json`,
      import.meta.url,
    ),
    "utf8",
  ),
);
const questions = [],
  deferred = [];
function walk(value) {
  if (!value || typeof value !== "object") return [];
  return [value, ...Object.values(value).flatMap(walk)];
}
function defer(lesson, slide, reason, row) {
  deferred.push({
    lesson: lesson.name,
    url: lesson.url,
    slide: slide.index,
    slideId: slide.id,
    ...(row ? { row } : {}),
    reason,
  });
}
function add(lesson, slide, row, prompt, choices, correct) {
  const issue = reviewIssue(grade, slide.id, row);
  if (issue) {
    defer(lesson, slide, issue, row);
    return;
  }
  if (/thẻ số bên|hình (?:bên|vẽ|dưới)|hình ảnh|quan sát hình/i.test(prompt)) {
    defer(lesson, slide, "Cần hình minh họa gốc để hiểu đầy đủ đề bài.", row);
    return;
  }
  if (
    prompt.length > 400 ||
    choices.some((choice) => choice.length > 180) ||
    new Set(choices).size !== 4
  ) {
    defer(
      lesson,
      slide,
      "Không đáp ứng giới hạn câu trắc nghiệm của ứng dụng.",
      row,
    );
    return;
  }
  const id = `ed${String(grade).padStart(2, "0")}0002-${String(lesson.id).padStart(4, "0")}-4000-8000-${String(slide.id).padStart(9, "0")}${String(row).padStart(3, "0")}`;
  questions.push({
    id,
    revision: 1,
    isDefault: true,
    lesson: lesson.name,
    subject: "Toán",
    grade,
    textbook: "Kết nối tri thức với cuộc sống",
    volume: 2,
    source: {
      provider: "Edulive",
      url: lesson.url,
      courseUrl: report.courseUrl,
      documentId: Number(lesson.id),
      slideId: slide.id,
      slide: slide.index,
      row,
      original: true,
    },
    body: { id, prompt, choices, correct, hint: "", explanation: "" },
  });
}
for (const lesson of report.lessons.filter((lesson) => lesson.slides)) {
  for (const slide of lesson.slides) {
    const variables = slide.variables || {};
    const db = variables.db;
    if (
      Array.isArray(db) &&
      db.length === 4 &&
      db.every(
        (row) =>
          Array.isArray(row) &&
          row.length === 2 &&
          ["0", "1"].includes(String(row[1])),
      )
    ) {
      const correct = db.flatMap((row, index) =>
        String(row[1]) === "1" ? [index] : [],
      );
      const prompts = slide.texts.filter(
        (text) => text.name === "Đề bài" && !text.hidden,
      );
      const events = JSON.stringify(slide.events);
      if (correct.length !== 1) {
        defer(
          lesson,
          slide,
          "Câu nhiều đáp án đúng; ứng dụng hiện chỉ hỗ trợ một đáp án.",
        );
        continue;
      }
      if (prompts.length !== 1 || !events.includes("$db[$nb,2]")) {
        defer(
          lesson,
          slide,
          "Chưa xác minh được đề bài và quy tắc chấm điểm từ sự kiện gốc.",
        );
        continue;
      }
      add(
        lesson,
        slide,
        1,
        prompts[0].text,
        db.map((row) => String(row[0])),
        correct[0],
      );
    } else if (
      Array.isArray(variables.Questions) &&
      variables.Questions.every(
        (row) =>
          Array.isArray(row) &&
          row.length === 5 &&
          row.every((value) => typeof value === "string"),
      )
    ) {
      const nodes = walk(slide.events);
      const correctObject = nodes.find((node) =>
        /^\$Questions\[\$\w+,2\]$/.test(node.properties?.text || ""),
      )?.ObjectId;
      const directFeedback = nodes.some(
        (node) =>
          String(node.ObjectId) === String(correctObject) &&
          node.properties?.fill === "#00ff00",
      );
      const click = nodes.find(
        (node) =>
          node.type === "c-mouse-event" &&
          String(node.attachObjectId) === String(correctObject),
      );
      const messages = walk(click)
        .filter((node) => node.type === "c-push-message-action")
        .map((node) => node.messageId);
      const messageFeedback = nodes.some(
        (node) =>
          node.type === "c-message-event" &&
          messages.includes(node.messageId) &&
          String(node.params?.ans?.value) === String(correctObject) &&
          walk(node).some(
            (action) =>
              action.ObjectId === "ans" &&
              action.properties?.fill === "#00ff00",
          ),
      );
      const greenFeedback = directFeedback || messageFeedback;
      if (!correctObject || !greenFeedback) {
        defer(
          lesson,
          slide,
          "Chưa xác minh được lựa chọn đúng qua sự kiện phản hồi gốc.",
        );
        continue;
      }
      variables.Questions.forEach(([prompt, ...choices], index) =>
        add(lesson, slide, index + 1, prompt, choices, 0),
      );
    } else if (
      ["db", "dabt", "dbtext", "Questions", "arr1", "da"].some(
        (key) => Array.isArray(variables[key]) && variables[key].length,
      )
    ) {
      defer(
        lesson,
        slide,
        "Bài điền số, nối, đúng/sai hoặc bài giải chưa tương thích với câu trắc nghiệm 4 lựa chọn.",
      );
    }
  }
}
if (!questions.length)
  throw new Error("No verified MCQs found; existing data was not overwritten.");
const manifest = {
  grade,
  volume: 2,
  courseUrl: report.courseUrl,
  importedAt: report.fetchedAt,
  publicLessonsRead: report.lessons.filter((lesson) => lesson.slides).length,
  publicSlidesRead: report.lessons.reduce(
    (sum, lesson) => sum + (lesson.slides?.length || 0),
    0,
  ),
  importedQuestions: questions.length,
  importedLessons: new Set(questions.map((question) => question.lesson)).size,
  completeCourse: false,
  lockedLessons: report.lockedLessons || [],
  unavailableLessons: report.lessons
    .filter((lesson) => lesson.error)
    .map(({ url, error }) => ({ url, error })),
  limitation: `Chỉ nhập câu trắc nghiệm một đáp án từ ${report.lessons.filter((lesson) => lesson.slides).length} tiết học mở. Các tiết bị khóa cần quyền truy cập hoặc tệp xuất do người dùng cung cấp. Lời giải và gợi ý để trống khi nguồn không có.`,
  deferred,
};
await writeFile(
  new URL(`../src/data/edulive-kntt-grade${grade}-volume2.ts`, import.meta.url),
  `// Generated by scripts/import-edulive-questions.mjs from public original slides.\nimport type { BankQuestion } from "./default-questions";\n\nexport const eduliveImport = ${JSON.stringify(manifest, null, 2)};\n\nexport const eduliveQuestions: BankQuestion[] = ${JSON.stringify(questions, null, 2)};\n`,
);
console.log(
  JSON.stringify(
    {
      questions: questions.length,
      lessons: manifest.importedLessons,
      publicLessonsRead: manifest.publicLessonsRead,
      publicSlidesRead: manifest.publicSlidesRead,
      deferred: deferred.length,
    },
    null,
    2,
  ),
);

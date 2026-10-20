import { describe, it, expect } from "vitest";
import { defaultQuestions } from "../data/default-questions";
import { mcqSchema } from "../domain/studio-spec";
import {
  eduliveImport,
  eduliveQuestions,
} from "../data/edulive-kntt-grade3-volume2";
import {
  eduliveImport as grade1Import,
  eduliveQuestions as grade1Questions,
} from "../data/edulive-kntt-grade1-volume2";
import {
  eduliveImport as grade2Import,
  eduliveQuestions as grade2Questions,
} from "../data/edulive-kntt-grade2-volume2";
import { allEduliveQuestions } from "../data/edulive-banks";
const canhDieuQuestions = defaultQuestions.filter(
  (row) => row.textbook === "Cánh Diều",
);
describe("Default lesson question bank", () => {
  it("has 20 lessons, six complete unique questions per lesson and stable unique IDs", () => {
    expect(canhDieuQuestions).toHaveLength(120);
    expect(new Set(canhDieuQuestions.map((q) => q.id)).size).toBe(120);
    expect(new Set(canhDieuQuestions.map((q) => q.body.prompt)).size).toBe(120);
    const lessons = new Set(canhDieuQuestions.map((q) => q.lesson));
    expect(lessons.size).toBe(20);
    for (const lesson of lessons)
      expect(canhDieuQuestions.filter((q) => q.lesson === lesson)).toHaveLength(
        6,
      );
    for (const row of canhDieuQuestions) {
      expect(mcqSchema.safeParse(row.body).success).toBe(true);
      expect(new Set(row.body.choices).size).toBe(4);
      expect(row.body.choices.every(Boolean)).toBe(true);
      expect(row.body.explanation).not.toBe("");
    }
  });
  it("computes table multiplication and division answers correctly", () => {
    for (const q of defaultQuestions.filter((r) =>
      /^Bảng (nhân|chia)/.test(r.lesson!),
    )) {
      const m = q.body.prompt.match(/(\d+) ([×:]) (\d+)/)!;
      const expected =
        m[2] === "×"
          ? Number(m[1]) * Number(m[3])
          : Number(m[1]) / Number(m[3]);
      expect(Number(q.body.choices[q.body.correct])).toBe(expected);
    }
  });
});

describe("Original Edulive questions · Kết nối tri thức · Toán 3 tập 2", () => {
  it("loads the verified subset without replacing the existing bank or claiming the whole course", () => {
    expect(eduliveQuestions).toHaveLength(25);
    expect(defaultQuestions).toHaveLength(168);
    expect(new Set(defaultQuestions.map((row) => row.id)).size).toBe(168);
    expect(eduliveImport.importedQuestions).toBe(eduliveQuestions.length);
    expect(eduliveImport.publicLessonsRead).toBe(23);
    expect(eduliveImport.completeCourse).toBe(false);
    for (const row of eduliveQuestions) {
      expect(mcqSchema.safeParse(row.body).success).toBe(true);
      expect(new Set(row.body.choices).size).toBe(4);
      expect(row.textbook).toBe("Kết nối tri thức với cuộc sống");
      expect(row.volume).toBe(2);
      expect(row.source?.original).toBe(true);
      expect(row.source?.url).toMatch(/^https:\/\/edulive.net\/bai-/);
      expect(row.source?.slideId).toBeGreaterThan(0);
      expect(row.body.hint).toBe("");
      expect(row.body.explanation).toBe("");
    }
  });
  it("preserves source text, option order and the correct index", () => {
    const original = eduliveQuestions.find(
      (row) => row.source?.slideId === 44027,
    )!;
    expect(original.body.prompt).toBe(
      "b) Số nào dưới đây có chữ số hàng chục là 7?",
    );
    expect(original.body.choices).toEqual(["5 782", "8 275", "2 587", "7 528"]);
    expect(original.body.correct).toBe(1);
    const gameQuestion = eduliveQuestions.find(
      (row) => row.source?.slideId === 54080,
    )!;
    expect(gameQuestion.body.prompt).toBe("Tính\n1293 : 3 =?");
    expect(gameQuestion.body.choices).toEqual(["431", "413", "421", "412"]);
    expect(gameQuestion.body.correct).toBe(0);
  });
  it("defers multi-answer, missing-illustration and erroneous source questions", () => {
    expect(eduliveQuestions.some((row) => row.source?.slideId === 58255)).toBe(
      false,
    );
    expect(eduliveQuestions.some((row) => row.source?.slideId === 44078)).toBe(
      false,
    );
    expect(
      eduliveQuestions.some(
        (row) => row.source?.slideId === 47956 && row.source.row === 3,
      ),
    ).toBe(false);
    expect(
      eduliveImport.deferred.some((row) =>
        row.reason.includes("phép chia có dư 2"),
      ),
    ).toBe(true);
  });
});

describe("Original Edulive questions · grades 1 and 2 · volume 2", () => {
  it("adds separately audited grades without changing the grade 3 collection", () => {
    expect(grade1Questions).toHaveLength(7);
    expect(grade2Questions).toHaveLength(16);
    expect(allEduliveQuestions).toHaveLength(48);
    expect(grade1Import.publicLessonsRead).toBe(15);
    expect(grade1Import.publicSlidesRead).toBe(244);
    expect(grade1Import.lockedLessons).toHaveLength(36);
    expect(grade2Import.publicLessonsRead).toBe(23);
    expect(grade2Import.publicSlidesRead).toBe(333);
    expect(grade2Import.lockedLessons).toHaveLength(63);
    for (const [grade, rows, manifest] of [
      [1, grade1Questions, grade1Import],
      [2, grade2Questions, grade2Import],
    ] as const) {
      expect(manifest.importedQuestions).toBe(rows.length);
      expect(manifest.completeCourse).toBe(false);
      for (const row of rows) {
        expect(mcqSchema.safeParse(row.body).success).toBe(true);
        expect(row.grade).toBe(grade);
        expect(row.volume).toBe(2);
        expect(row.body.id).toBe(row.id);
        expect(new Set(row.body.choices).size).toBe(4);
        expect(row.source?.original).toBe(true);
        expect(row.source?.courseUrl).toContain(`toan-lop-${grade}-`);
        expect(row.source?.slideId).toBeGreaterThan(0);
        expect(row.body.hint).toBe("");
        expect(row.body.explanation).toBe("");
      }
    }
  });
  it("preserves the original prompt, options and correct answer for each new grade", () => {
    const one = grade1Questions.find((row) => row.source?.slideId === 47539)!;
    expect(one.body.prompt).toBe("Số 13 gồm có:");
    expect(one.body.choices).toEqual([
      "1 chục và 2 đơn vị",
      "1 chục và 3 đơn vị",
      "1 chục và 4 đơn vị",
      "1 chục và 0 đơn vị",
    ]);
    expect(one.body.correct).toBe(1);
    const two = grade2Questions.find((row) => row.source?.slideId === 59889)!;
    expect(two.body.prompt).toBe(
      "Một thanh sô-cô-la có 10 miếng.\nHỏi 5 thanh sô-cô-la có bao nhiêu miếng?",
    );
    expect(two.body.choices).toEqual(["30", "40", "50", "60"]);
    expect(two.body.correct).toBe(2);
  });
  it("checks imported grade 1 additions and excludes image-only or ambiguous exercises", () => {
    const sums = grade1Questions.filter(
      (row) => row.source?.slideId === 160488,
    );
    expect(sums).toHaveLength(6);
    for (const row of sums) {
      const match = row.body.prompt.match(/^(\d+)\s*\+\s*(\d+)\s*=\s*\?$/)!;
      expect(Number(row.body.choices[row.body.correct])).toBe(
        Number(match[1]) + Number(match[2]),
      );
    }
    expect(
      grade1Questions.some((row) =>
        [47502, 56542, 42237].includes(row.source!.slideId),
      ),
    ).toBe(false);
    expect(
      grade2Questions.some((row) =>
        [43527, 59858, 54191, 54196, 55205].includes(row.source!.slideId),
      ),
    ).toBe(false);
    expect(
      grade2Questions.some(
        (row) =>
          row.source?.slideId === 55214 && [3, 5].includes(row.source.row),
      ),
    ).toBe(false);
    expect(
      grade2Import.deferred.some((row) => row.reason.includes("hoán đổi")),
    ).toBe(true);
  });
});

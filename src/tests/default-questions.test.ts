import { describe, it, expect } from "vitest";
import { defaultQuestions } from "../data/default-questions";
import { mcqSchema } from "../domain/studio-spec";
describe("Default lesson question bank", () => {
  it("has 20 lessons, six complete unique questions per lesson and stable unique IDs", () => {
    expect(defaultQuestions).toHaveLength(120);
    expect(new Set(defaultQuestions.map((q) => q.id)).size).toBe(120);
    expect(new Set(defaultQuestions.map((q) => q.body.prompt)).size).toBe(120);
    const lessons = new Set(defaultQuestions.map((q) => q.lesson));
    expect(lessons.size).toBe(20);
    for (const lesson of lessons)
      expect(defaultQuestions.filter((q) => q.lesson === lesson)).toHaveLength(
        6,
      );
    for (const row of defaultQuestions) {
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

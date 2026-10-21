import { describe, it, expect } from "vitest";
import { cueForNarration, vietnameseCues } from "../domain/narration-cues";
describe("Vietnamese recorded cues", () => {
  it("maps every shipped cue to itself", () => {
    for (const [id, text] of Object.entries(vietnameseCues))
      expect(cueForNarration(text)).toBe(id);
  });
  it("uses generic prerecorded feedback without names or custom hints", () => {
    expect(cueForNarration("Thử lại nhé! Gợi ý bí mật")).toBe("retry");
    expect(cueForNarration("Đội Sao quay được 30 điểm.")).toBe("turn");
    expect(cueForNarration("Đội Sao đoán A: không có, chuyển lượt.")).toBe(
      "lose",
    );
    expect(cueForNarration("")).toBeNull();
  });
});

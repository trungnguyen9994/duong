import { it, expect } from "vitest";
import { narrationVoice } from "../studio/useVietnameseNarration";
it("supports an English-only device and still prefers Vietnamese if installed", () => {
  const english = {
    name: "David",
    lang: "en-US",
    localService: true,
  } as SpeechSynthesisVoice;
  const vi = {
    name: "Vietnamese",
    lang: "vi-VN",
    localService: true,
  } as SpeechSynthesisVoice;
  expect(narrationVoice([english])).toBe(english);
  expect(narrationVoice([english, vi])).toBe(vi);
  expect(narrationVoice([])).toBeUndefined();
});

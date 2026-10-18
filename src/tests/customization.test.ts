import { it, expect } from "vitest";
import JSZip from "jszip";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import {
  createStudioGame,
  questionsOf,
  templateTypes,
} from "../domain/studio-spec";
import { renderPptx } from "../../server/pptx";
import { characterLabel } from "../domain/media-capabilities";

const background = "11111111-1111-4111-8111-111111111111";
const illustration = "22222222-2222-4222-8222-222222222222";
const secret = "33333333-3333-4333-8333-333333333333";
it.each(templateTypes)(
  "%s exports the chosen font, colors, background and question illustration",
  async (kind) => {
    const spec = createStudioGame(kind);
    const makeQuestion = () => ({
      id: crypto.randomUUID(),
      prompt: "Câu hỏi minh họa",
      choices: ["Một", "Hai", "Ba", "Bốn"],
      correct: 0,
      hint: "",
      explanation: "Lời giải",
    });
    if (spec.kind === "journey")
      spec.content.stages.forEach(
        (stage) => (stage.questions = [makeQuestion()]),
      );
    else if (spec.kind === "picture_reveal") {
      spec.content.answer = "Bức tranh";
      spec.content.questions = Array.from(
        { length: spec.content.size },
        makeQuestion,
      );
    } else if (spec.kind === "word_wheel") {
      spec.content.phrase = "TRƯỜNG HỌC";
      spec.content.clue = "Nơi em học";
    }
    for (const q of questionsOf(spec)) {
      q.prompt = "Câu hỏi minh họa";
      q.choices = ["Một", "Hai", "Ba", kind === "boat_rescue" ? "" : "Bốn"];
      q.correct = 0;
    }
    spec.appearance = {
      font: "Georgia",
      text: "#123456",
      heading: "#345678",
      question: "#456789",
      answer: "#56789a",
    };
    spec.media.backgroundId = background;
    const q = questionsOf(spec)[0];
    if (q) q.imageId = illustration;
    if (spec.kind === "picture_reveal") spec.content.imageId = secret;
    const raster = async (r: number, g: number, b: number) =>
      sharp({
        create: { width: 90, height: 60, channels: 3, background: { r, g, b } },
      })
        .png()
        .toBuffer();
    const assets = new Map([
      [background, await raster(255, 0, 0)],
      [illustration, await raster(0, 255, 0)],
      [secret, await raster(0, 0, 255)],
    ]);
    const output = await renderPptx(spec, assets);
    if (process.env.CUSTOMIZATION_PREVIEW === "1") {
      await mkdir("data/previews/customization", { recursive: true });
      await writeFile(`data/previews/customization/${kind}.pptx`, output);
    }
    const zip = await JSZip.loadAsync(output);
    const slides = await Promise.all(
      Object.keys(zip.files)
        .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
        .map((p) => zip.file(p)!.async("string")),
    );
    expect(slides.join("")).toContain("Georgia");
    expect(slides.join("").toUpperCase()).toContain("123456");
    if (
      [
        "clever_frog",
        "forest_rescue",
        "boat_rescue",
        "football",
        "picture_reveal",
      ].includes(kind)
    ) {
      expect(slides.join("")).toContain("rIdQuestionImage");
      expect(slides.join("").toUpperCase()).toContain("456789");
      expect(slides.join("").toUpperCase()).toContain("56789A");
    }
    if (kind === "picture_reveal") {
      const board = await zip.file("ppt/slides/slide2.xml")!.async("string");
      expect(board).toContain("rIdCustom13");
      // Secret stays blue, rather than the selected red scene or a shared source asset.
      const data = await zip
        .file("ppt/media/custom-2-13.png")!
        .async("nodebuffer");
      const pixel = await sharp(data)
        .resize(1, 1)
        .removeAlpha()
        .raw()
        .toBuffer();
      expect([...pixel]).toEqual([0, 0, 255]);
    }
    if (kind === "football") {
      const rels = await zip
        .file("ppt/slides/_rels/slide2.xml.rels")!
        .async("string");
      expect(rels).toMatch(/Id="rIdNextQuestion"[^>]*Target="slide3.xml"/);
      expect(slides.join("")).toContain("rIdGameBackground");
    }
  },
  30000,
);
it("only exposes supported character roles", () => {
  expect(characterLabel("football")).toBe("Thủ môn");
  expect(characterLabel("boat_rescue")).toBeNull();
  expect(characterLabel("forest_rescue")).toBeNull();
  expect(characterLabel("clever_frog")).toBe("Nhân vật đồng hành");
});

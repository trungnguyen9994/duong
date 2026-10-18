import { describe, it, expect } from "vitest";
import {
  createStudioGame,
  letterKey,
  phraseKey,
  playableErrors,
  studioSpecSchema,
} from "../domain/studio-spec";
import { migrateLegacy } from "../domain/studio-migration";
import { sampleGame } from "../domain/sample";
import {
  initialJourney,
  answerJourney,
  nextJourney,
  initialPicture,
  selectTile,
  answerTile,
  guessPicture,
  initialWheel,
  spinWheel,
  guessLetter,
  solveWheel,
} from "../domain/studio-rules";
import {
  journeySlides,
  pictureSlides,
  wheelSlides,
  renderPptx,
} from "../../server/pptx";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import sharp from "sharp";
import { cropImage } from "../../server/media-crop";

describe("V4.1 contract", () => {
  it.each([1, 5, 12])(
    "supports %i journey stages and complete PPTX links",
    async (count) => {
      const s = await migrateLegacy(sampleGame(), async () =>
        crypto.randomUUID(),
      );
      if (s.kind !== "journey") throw Error();
      const base = s.content.stages[0];
      s.content.stages = Array.from({ length: count }, (_, i) => ({
        ...structuredClone(base),
        id: crypto.randomUUID(),
        title: `Chặng ${i + 1}`,
        questions: [
          { ...structuredClone(base.questions[0]), id: crypto.randomUUID() },
        ],
      }));
      expect(studioSpecSchema.safeParse(s).success).toBe(true);
      const nodes = journeySlides(s),
        ids = new Set(nodes.map((n) => n.id));
      for (const node of nodes)
        for (const b of node.buttons) expect(ids.has(b.target)).toBe(true);
      expect(
        nodes.find((n) => n.id === `correct-${count - 1}-0`)!.buttons[0].target,
      ).toBe("summary");
      if (count === 5)
        expect((await renderPptx(s, new Map())).length).toBeGreaterThan(1000);
    },
    30000,
  );
  it("crops a new image with fit, position, zoom and alpha without modifying source", async () => {
    const original = await sharp({
        create: { width: 300, height: 100, channels: 4, background: "#1677ff" },
      })
        .png()
        .toBuffer(),
      before = Buffer.from(original);
    const result = await cropImage(original, {
        fit: "contain",
        x: 100,
        y: 0,
        zoom: 1,
        opacity: 0.5,
        aspect: "4:5",
      }),
      metadata = await sharp(result).metadata();
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(640);
    expect(metadata.hasAlpha).toBe(true);
    expect(original.equals(before)).toBe(true);
  });
  it("allows incomplete drafts but blocks play; rejects the legacy version", () => {
    const draft = createStudioGame();
    expect(studioSpecSchema.safeParse(draft).success).toBe(true);
    expect(playableErrors(draft).length).toBeGreaterThan(0);
    expect(studioSpecSchema.safeParse(sampleGame()).success).toBe(false);
  });
  it("copies question snapshots and IDs without touching local source", async () => {
    const old = sampleGame(),
      before = JSON.stringify(old);
    const migrated = await migrateLegacy(old, async () => crypto.randomUUID());
    expect(JSON.stringify(old)).toBe(before);
    expect(playableErrors(migrated)).toEqual([]);
    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.id).not.toBe(old.id);
  });
  it("preserves Vietnamese vowel shape and full phrase tones", () => {
    expect(letterKey("ắ")).toBe("Ă");
    expect(letterKey("ấ")).toBe("Â");
    expect(letterKey("ờ")).toBe("Ơ");
    expect(letterKey("đ")).toBe("Đ");
    expect(letterKey("á")).toBe("A");
    expect(letterKey("ă")).not.toBe(letterKey("a"));
    expect(phraseKey("  Cánh   Diều ")).toBe(phraseKey("cánh diều"));
    expect(phraseKey("canh dieu")).not.toBe(phraseKey("cánh diều"));
  });
  it("awards retry points once with stage multiplier and rotates teams", async () => {
    const s = await migrateLegacy(sampleGame(), async () =>
      crypto.randomUUID(),
    );
    if (s.kind !== "journey") throw Error();
    s.content.stages[0].multiplier = 2;
    let state = initialJourney(s);
    state = { ...state, phase: "question" };
    const q = s.content.stages[0].questions[0];
    state = answerJourney(s, state, (q.correct + 1) % 4);
    expect(state.phase).toBe("wrong");
    state = { ...state, phase: "question" };
    state = answerJourney(s, state, q.correct);
    expect(state.scores[0]).toBe(10);
    expect(answerJourney(s, state, q.correct)).toEqual(state);
    expect(nextJourney(s, state).team).toBe(1);
  });
  it("compiles every journey link and produces an editable PPTX offline", async () => {
    const s = await migrateLegacy(sampleGame(), async () =>
        crypto.randomUUID(),
      ),
      nodes = journeySlides(s),
      ids = new Set(nodes.map((n) => n.id));
    expect(nodes.length).toBe(43);
    for (const node of nodes)
      for (const b of node.buttons) expect(ids.has(b.target)).toBe(true);
    s.appearance = {
      font: "Georgia",
      text: "#123456",
      question: "#abcdef",
      answer: "#fedcba",
      heading: "#654321",
    };
    const result = await renderPptx(s, new Map());
    const zip = await JSZip.loadAsync(result);
    const theme = await zip.file("ppt/theme/theme1.xml")!.async("string");
    expect(theme).toContain("Georgia");
    const xmls = await Promise.all(
      Object.keys(zip.files)
        .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
        .map((p) => zip.file(p)!.async("string")),
    );
    const xml = xmls.join("");
    for (const color of ["123456", "abcdef", "fedcba", "654321"])
      expect(xml.toLowerCase()).toContain(color);
    expect(xml).toContain("Thời gian:");
    expect(xml).toContain(" : ____");
    // Default scenery plus the default character are both embedded offline.
    expect(
      Object.keys(zip.files).filter(
        (p) => p.startsWith("ppt/media/") && !zip.files[p].dir,
      ).length,
    ).toBeGreaterThan(4);
    expect(result.subarray(0, 2).toString()).toBe("PK");
    expect(result.length).toBeLessThan(50 * 1024 * 1024);
  }, 30000);
  it("exports the selected character and rejects missing selected media", async () => {
    const s = await migrateLegacy(sampleGame(), async () =>
      crypto.randomUUID(),
    );
    const id = crypto.randomUUID();
    s.media.characterId = id;
    await expect(renderPptx(s, new Map())).rejects.toThrow("nhân vật");
    const image = await sharp({
      create: { width: 200, height: 100, channels: 4, background: "#ff00aa" },
    })
      .png()
      .toBuffer();
    const result = await renderPptx(s, new Map([[id, image]]));
    const zip = await JSZip.loadAsync(result);
    const media = await Promise.all(
      Object.keys(zip.files)
        .filter((p) => p.startsWith("ppt/media/") && !zip.files[p].dir)
        .map((p) => zip.file(p)!.async("nodebuffer")),
    );
    const pixels = await Promise.all(
      media.map(async (b) => {
        try {
          return await sharp(b).stats();
        } catch {
          return null;
        }
      }),
    );
    expect(
      pixels.some(
        (stats) =>
          stats &&
          stats.channels[0].mean === 255 &&
          stats.channels[1].mean === 0 &&
          stats.channels[2].mean === 170,
      ),
    ).toBe(true);
    const xml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(xml).toContain('cx="1234440" cy="617220"');
  }, 30000);
  it.each([4, 6, 9] as const)(
    "picture grid %i exports arbitrary tile selection and returning question shows",
    async (size) => {
      const s = createStudioGame("picture_reveal");
      if (s.kind !== "picture_reveal") throw Error();
      s.content.size = size;
      s.content.imageId = crypto.randomUUID();
      s.content.answer = "Cây xanh";
      s.content.earlyGuess = false;
      s.content.questions = Array.from({ length: size }, () => ({
        id: crypto.randomUUID(),
        prompt: "Cây cần gì?",
        choices: ["Nước", "Nhựa", "Đá", "Sắt"],
        correct: 0,
        hint: "Dùng để tưới cây.",
        explanation: "Cây cần nước.",
      }));
      let state = initialPicture(s);
      expect(guessPicture(s, state, "Cây xanh")).toEqual(state);
      state = selectTile(s, state, 2);
      state = answerTile(s, state, 1);
      expect(state.opened).toEqual([]);
      state = { ...state, phase: "question" };
      state = answerTile(s, state, 0);
      expect(state.opened).toEqual([2]);
      expect(state.scores[0]).toBe(5);
      expect(answerTile(s, state, 0)).toEqual(state);
      expect(selectTile(s, { ...state, phase: "board" }, 2).active).toBe(2);
      const nodes = pictureSlides(s),
        ids = new Set(nodes.map((n) => n.id));
      expect(nodes.length).toBe(size + 3);
      for (const node of nodes)
        for (const button of node.buttons)
          expect(ids.has(button.target)).toBe(true);
      const file = await renderPptx(
          s,
          new Map([
            [s.content.imageId, await readFile("public/art/forest.png")],
          ]),
        ),
        zip = await JSZip.loadAsync(file);
      expect(
        Object.keys(zip.files).filter((p) =>
          /^ppt\/slides\/slide\d+\.xml$/.test(p),
        ),
      ).toHaveLength(size === 6 ? nodes.length - 1 : nodes.length);
      const xml = await zip.file("ppt/slides/slide2.xml")!.async("string");
      expect(xml).toContain("hlinkClick");
      if (size === 6) {
        expect(xml).toContain("<p:animScale>");
        expect(xml).toContain('presetClass="exit"');
        const question = await zip.file("ppt/slides/slide3.xml")!.async("string");
        expect(question).toContain("Đáp án: Nước");
        expect(question).toContain('presetClass="entr"');
        return;
      }
      expect(xml).toContain("<a:t>1</a:t>");
      expect(xml).toContain('nodeType="interactiveSeq"');
      expect(xml).toContain("ppaction://customshow?id=0&amp;return=true");
      expect(xml).toContain('val="hidden"');
      const presentation = await zip
        .file("ppt/presentation.xml")!
        .async("string");
      expect([...presentation.matchAll(/<p:custShow /g)]).toHaveLength(size);
      const question = await zip.file("ppt/slides/slide3.xml")!.async("string");
      expect(question).toContain("ppaction://hlinkshowjump?jump=endshow");
      expect(question).toContain("puzzle-answer-button");
      expect(question).toContain("Đáp án: A. Nước");
      expect(question).toContain('repeatCount="indefinite"');
      expect(question).toContain('r:embed="rIdPuzzleChime"');
      expect(zip.file("ppt/media/puzzle-chime.wav")).not.toBeNull();
      const objectIds = [
        ...question.matchAll(/<p:cNvPr\b[^>]*id="(\d+)"/g),
      ].map((m) => m[1]);
      for (const target of question.matchAll(/<p:spTgt spid="(\d+)"/g))
        expect(objectIds).toContain(target[1]);
      const timingIds = [...question.matchAll(/<p:cTn id="(\d+)"/g)].map(
        (m) => m[1],
      );
      expect(new Set(timingIds).size).toBe(timingIds.length);
      if (size === 4) {
        s.settings.reducedMotion = true;
        const reduced = await JSZip.loadAsync(
          await renderPptx(
            s,
            new Map([
              [s.content.imageId, await readFile("public/art/forest.png")],
            ]),
          ),
        );
        const reducedQuestion = await reduced
          .file("ppt/slides/slide3.xml")!
          .async("string");
        expect(reducedQuestion).toContain('nodeType="interactiveSeq"');
        expect(reducedQuestion).not.toContain("<p:animEffect");
        expect(reducedQuestion).not.toContain("<p:animRot");
        expect(reduced.file("ppt/media/puzzle-chime.wav")).toBeNull();
      }
    },
    30000,
  );
  it("wheel keeps vowel distinctions, repeated guesses, turn order and phrase scoring", async () => {
    const s = createStudioGame("word_wheel");
    s.settings.playMode = "teams";
    s.settings.teams = ["Tổ 1", "Tổ 2", "Tổ 3", "Tổ 4"];
    if (s.kind !== "word_wheel") throw Error();
    s.content.phrase = "CÁNH DIỀU";
    s.content.clue = "Bay trên bầu trời";
    let state = initialWheel(s);
    state = spinWheel(s, state, 7);
    expect(state.team).toBe(1);
    expect(state.phase).toBe("spin");
    state = spinWheel(s, state, 1);
    state = guessLetter(s, state, "a");
    expect(state.scores[1]).toBe(20);
    expect(state.team).toBe(1);
    expect(state.guessed).toContain("A");
    state = spinWheel(s, state, 2);
    const repeated = guessLetter(s, state, "á");
    expect(repeated.scores).toEqual(state.scores);
    expect(repeated.phase).toBe("letter");
    state = guessLetter(s, state, "Ă");
    expect(state.team).toBe(2);
    expect(state.scores[1]).toBe(20);
    state = solveWheel(s, state, "canh dieu");
    expect(state.phase).toBe("spin");
    state = solveWheel(s, state, " cánh   diều ");
    expect(state.phase).toBe("summary");
    expect(state.scores[3]).toBe(50);
    expect(solveWheel(s, state, "cánh diều")).toEqual(state);
    const nodes = wheelSlides(s),
      ids = new Set(nodes.map((n) => n.id));
    for (const n of nodes)
      for (const b of n.buttons) expect(ids.has(b.target)).toBe(true);
    const pptx = await renderPptx(s, new Map()),
      zip = await JSZip.loadAsync(pptx);
    const last = await zip
      .file(`ppt/slides/slide${nodes.length}.xml`)!
      .async("string");
    expect(last).toContain("CÁNH DIỀU");
  }, 30000);
});

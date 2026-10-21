import { addPowerPointMotion } from "./pptx-motion";
import { addPictureInteraction } from "./pptx-picture";
import { adventureSlides, renderAdventurePptx } from "./pptx-adventure";
import { isAdventure } from "../src/domain/adventure-config";
import { hasReferenceTemplate, renderReferencePptx } from "./pptx-reference";
import pptxgen from "pptxgenjs";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
sharp.concurrency(1);
sharp.cache({ memory: 16, files: 0, items: 32 });
function defaultScenes() {
  return (async () => {
    const scenes: string[] = [];
    for (const name of ["forest", "mountain", "cave", "castle"]) {
      const data = await sharp(
        await readFile(new URL(`../public/art/${name}.png`, import.meta.url)),
      )
        .resize(1280, 720, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toBuffer();
      scenes.push(`image/jpeg;base64,${data.toString("base64")}`);
    }
    return scenes;
  })();
}
import {
  letterKey,
  playableErrors,
  type StudioSpec,
} from "../src/domain/studio-spec";

type Node = {
  id: string;
  title: string;
  text: string;
  buttons: { text: string; target: string }[];
  scene: number;
  imageId?: string;
  picture?: { size: number; opened: number; imageId: string };
  word?: { phrase: string; letters: string[] };
  revealAnswer?: string;
  frogs?: { label: string; index: number }[];
};
export function journeySlides(spec: StudioSpec): Node[] {
  if (spec.kind !== "journey") throw new Error("Chưa có adapter cho mẫu này.");
  const errors = playableErrors(spec);
  if (errors.length) throw new Error(errors.join(" "));
  const nodes: Node[] = [
    {
      id: "cover",
      title: spec.metadata.title,
      text: spec.metadata.description,
      buttons: [{ text: "Bắt đầu", target: "instructions" }],
      scene: 0,
    },
    {
      id: "instructions",
      title: "Cùng khám phá tri thức",
      text:
        "Lần lượt gọi học sinh hoặc tổ trả lời. Đúng lần đầu: " +
        spec.settings.pointsFirst +
        " điểm; sau gợi ý: " +
        spec.settings.pointsRetry +
        " điểm.\nGiáo viên ghi điểm và quản lý thời gian thủ công.",
      buttons: [{ text: "Vào hành trình", target: "stage-0" }],
      scene: 0,
    },
  ];
  spec.content.stages.forEach((stage, i) => {
    nodes.push({
      id: `stage-${i}`,
      title: `Chặng ${i + 1}: ${stage.title}`,
      text: `Hệ số điểm: ${stage.multiplier}. Cùng sẵn sàng nhé!`,
      buttons: [{ text: "Bắt đầu chặng", target: `q-${i}-0` }],
      scene: i,
    });
    stage.questions.forEach((q, j) => {
      const next =
        j + 1 < stage.questions.length
          ? `q-${i}-${j + 1}`
          : i < spec.content.stages.length - 1
            ? `stage-${i + 1}`
            : "summary";
      nodes.push({
        id: `q-${i}-${j}`,
        title: `${stage.title} · Câu ${j + 1}`,
        text: q.prompt,
        buttons: q.choices.map((text, k) => ({
          text: `${"ABCD"[k]}. ${text}`,
          target: `${k === q.correct ? "correct" : "wrong"}-${i}-${j}`,
        })),
        scene: i,
        imageId: q.imageId,
      });
      nodes.push({
        id: `correct-${i}-${j}`,
        title: "Chính xác!",
        text: q.explanation || "Làm tốt lắm!",
        buttons: [{ text: "Tiếp theo", target: next }],
        scene: i,
      });
      nodes.push({
        id: `wrong-${i}-${j}`,
        title: "Thử lại nhé!",
        text: q.hint || "Cùng suy nghĩ thêm nhé.",
        buttons: [{ text: "Chọn lại đáp án", target: `q-${i}-${j}` }],
        scene: i,
      });
    });
  });
  nodes.push({
    id: "summary",
    title: "Chúc mừng cả lớp!",
    text: "Cả lớp đã hoàn thành hành trình tri thức.\nGiáo viên tổng kết điểm và trao lời khen cho cả lớp.",
    buttons: [{ text: "Chơi lại", target: "cover" }],
    scene: spec.content.stages.length - 1,
  });
  return nodes;
}
export function pictureSlides(spec: StudioSpec): Node[] {
  if (spec.kind !== "picture_reveal") throw new Error("Sai mẫu.");
  const errors = playableErrors(spec);
  if (errors.length) throw new Error(errors.join(" "));
  const nodes: Node[] = [
    {
      id: "cover",
      title: spec.metadata.title,
      text: "Chọn mảnh ghép bất kỳ để mở câu hỏi. Bấm Hiện đáp án để kiểm tra, rồi Quay về bảng.\nGiáo viên điều khiển việc mở mảnh, ghi điểm và thời gian trong Slide Show.",
      buttons: [{ text: "Bắt đầu", target: "board-0" }],
      scene: 0,
    },
  ];
  {
    nodes.push({
      id: "board-0",
      title: "Mảnh ghép bí mật",
      text: "",
      buttons: [
        {
          text: "Giải bức tranh",
          target: "summary",
        },
      ],
      scene: 0,
      picture: {
        size: spec.content.size,
        opened: 0,
        imageId: spec.content.imageId!,
      },
    });
  }
  for (let i = 0; i < spec.content.size; i++) {
    const q = spec.content.questions[i];
    nodes.push({
      id: `q-${i}`,
      title: `Mảnh ghép ${i + 1}`,
      text:
        q.prompt +
        "\n\n" +
        q.choices.map((c, j) => `${"ABCD"[j]}. ${c}`).join("\n"),
      buttons: [{ text: "Quay về bảng", target: "board-0" }],
      revealAnswer: `Đáp án: ${"ABCD"[q.correct]}. ${q.choices[q.correct]}${q.explanation ? "\n" + q.explanation : ""}`,
      scene: 0,
      imageId: q.imageId,
    });
  }
  nodes.push({
    id: "summary",
    title: "Bức tranh bí mật",
    text: spec.content.answer,
    buttons: [{ text: "Chơi lại", target: "cover" }],
    scene: 0,
  });
  return nodes;
}
export function wheelSlides(spec: StudioSpec): Node[] {
  if (spec.kind !== "word_wheel") throw new Error("Sai mẫu.");
  const errors = playableErrors(spec);
  if (errors.length) throw new Error(errors.join(" "));
  const keys = [
    ...new Set(
      Array.from(spec.content.phrase.normalize("NFC"))
        .filter((c) => /\p{L}/u.test(c))
        .map(letterKey),
    ),
  ];
  const nodes: Node[] = [
    {
      id: "cover",
      title: spec.metadata.title,
      text: "Vòng quay ô chữ · PowerPoint hướng dẫn\nMở chữ theo kịch bản cố định. Giáo viên quay và ghi điểm thủ công.\nKhông có vòng quay ngẫu nhiên hoặc trạng thái mở chữ tùy ý.",
      buttons: [{ text: "Luật chơi", target: "rules" }],
      scene: 3,
    },
    {
      id: "rules",
      title: "Cùng giải ô chữ",
      text: "Các ô điểm: 10, 20, 30, 40, 10, 20, 30, mất lượt.\nĐúng chữ: điểm × số chữ xuất hiện, giữ lượt. Sai: chuyển lượt.\nGiải đúng cụm từ: +50 điểm và kết thúc.",
      buttons: [{ text: "Bắt đầu", target: "word-0" }],
      scene: 3,
    },
  ];
  for (let i = 0; i <= keys.length; i++)
    nodes.push({
      id: `word-${i}`,
      title: i ? `Mở chữ ${keys[i - 1]}` : "Cụm từ bí mật",
      text: spec.content.clue,
      buttons: [
        {
          text: i < keys.length ? `Mở chữ ${keys[i]}` : "Hiện đáp án",
          target: i < keys.length ? `word-${i + 1}` : "summary",
        },
      ],
      scene: 3,
      word: { phrase: spec.content.phrase, letters: keys.slice(0, i) },
    });
  nodes.push({
    id: "summary",
    title: "Chúc mừng cả lớp!",
    text: spec.content.phrase,
    buttons: [{ text: "Chơi lại", target: "cover" }],
    scene: 3,
  });
  return nodes;
}
export function frogSlides(spec: StudioSpec): Node[] {
  if (spec.kind !== "clever_frog") throw Error("Sai mẫu.");
  const errors = playableErrors(spec);
  if (errors.length) throw Error(errors.join(" "));
  return [
    {
      id: "cover",
      title: spec.metadata.title,
      text: "Chọn một chú ếch để khám phá câu hỏi.\nHọc sinh trả lời miệng; giáo viên bấm Hiện đáp án rồi Quay về ao.\nGiáo viên quản lý điểm và thời gian.",
      buttons: [{ text: "Vào ao ếch", target: "board-0" }],
      scene: 0,
    },
    {
      id: "board-0",
      title: spec.metadata.title,
      text: "",
      buttons: [{ text: "Hoàn thành", target: "summary" }],
      scene: 0,
      frogs: spec.content.questions.map((q, index) => ({
        label: q.label || `Ếch ${index + 1}`,
        index,
      })),
    },
    ...spec.content.questions.map((q, i): Node => ({
      id: `q-${i}`,
      title: q.label || `Ếch ${i + 1}`,
      text: q.prompt,
      revealAnswer: `Đáp án: ${q.choices[q.correct]}${q.explanation ? "\n" + q.explanation : ""}`,
      imageId: q.imageId,
      buttons: [{ text: "Quay về ao", target: "board-0" }],
      scene: 0,
    })),
    {
      id: "summary",
      title: "Chúc mừng cả lớp!",
      text: "Các chú ếch đã hoàn thành thử thách.\nCùng tổng kết điểm và khen ngợi cả lớp!",
      buttons: [{ text: "Về trang đầu", target: "cover" }],
      scene: 0,
    },
  ];
}
export const pptxAdapters = Object.freeze({
  "doremon_travel@1": (spec: StudioSpec): Node[] => {
    const errors = playableErrors(spec);
    if (errors.length) throw Error(errors.join(" "));
    if (spec.kind !== "doremon_travel") throw Error("Sai mẫu trò chơi.");
    return [
      { id: "cover", title: spec.metadata.title, text: spec.metadata.description, buttons: [{ text: "Bắt đầu", target: "q-0" }], scene: 0 },
      ...spec.content.questions.map((q, i) => ({ id: `q-${i}`, title: q.label || `Điểm đến ${i + 1}`, text: q.prompt, buttons: [{ text: i < 3 ? "Điểm đến tiếp theo" : "Chơi lại", target: i < 3 ? `q-${i + 1}` : "cover" }], scene: i + 1 })),
    ];
  },
  "forest_rescue@1": adventureSlides,
  "boat_rescue@1": adventureSlides,
  "football@1": adventureSlides,
  "clever_frog@1": frogSlides,
  "journey@1": journeySlides,
  "picture_reveal@1": pictureSlides,
  "word_wheel@1": wheelSlides,
});
export function deckSlides(s: StudioSpec): Node[] {
  const adapter =
    pptxAdapters[
      `${s.template.type}@${s.template.version}` as keyof typeof pptxAdapters
    ];
  if (!adapter) throw new Error("Không tìm thấy PPTX adapter.");
  return adapter(s);
}
export async function cropBackground(
  source: Buffer,
  media: StudioSpec["media"],
  frame = { width: 1280, height: 720 },
): Promise<Buffer> {
  const rotated = await sharp(source).rotate().toBuffer(),
    meta = await sharp(rotated).metadata();
  const base =
    media.fit === "cover"
      ? Math.max(frame.width / meta.width!, frame.height / meta.height!)
      : Math.min(frame.width / meta.width!, frame.height / meta.height!);
  const width = Math.max(1, Math.round(meta.width! * base * media.zoom)),
    height = Math.max(1, Math.round(meta.height! * base * media.zoom));
  if(width*height>32000000)throw Error("Vùng phóng ảnh quá lớn. Hãy giảm zoom hoặc chọn ảnh gần tỷ lệ khung hơn.");
  let resized = await sharp(rotated).resize(width, height).toBuffer();
  const left = Math.round(((frame.width - width) * media.x) / 100),
    top = Math.round(((frame.height - height) * media.y) / 100);
  const cropLeft = Math.max(0, -left),
    cropTop = Math.max(0, -top),
    cropWidth = Math.min(width - cropLeft, frame.width),
    cropHeight = Math.min(height - cropTop, frame.height);
  resized = await sharp(resized)
    .extract({
      left: cropLeft,
      top: cropTop,
      width: cropWidth,
      height: cropHeight,
    })
    .toBuffer();
  return sharp({
    create: {
      width: frame.width,
      height: frame.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: resized, left: Math.max(0, left), top: Math.max(0, top) },
    ])
    .png()
    .toBuffer();
}
export async function renderPptx(
  spec: StudioSpec,
  assets: Map<string, Buffer>,
): Promise<Buffer> {
  if (hasReferenceTemplate(spec)) return renderReferencePptx(spec, assets);
  if (isAdventure(spec.kind)) return renderAdventurePptx(spec, assets);
  const nodes = deckSlides(spec);
  if (nodes.length > 60)
    throw new Error(`Bài cần ${nodes.length} slide, vượt giới hạn 60.`);
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = spec.metadata.title;
  pptx.author = "EduGame Studio";
  pptx.subject = spec.metadata.subjectId;
  pptx.theme = {
    headFontFace: spec.appearance?.font || "Roboto",
    bodyFontFace: spec.appearance?.font || "Roboto",
  };
  const scenes = await defaultScenes();
  const frogScene =
    spec.kind === "clever_frog"
      ? `image/jpeg;base64,${(
          await sharp(
            await readFile(
              new URL("../public/art/frog/image1.png", import.meta.url),
            ),
          )
            .resize(1280, 720, { fit: "cover" })
            .jpeg({ quality: 82 })
            .toBuffer()
        ).toString("base64")}`
      : undefined;
  const frogImages =
    spec.kind === "clever_frog"
      ? await Promise.all(
          [7, 8, 9, 10, 11, 12, 13, 14, 5, 6].map(async (n) => {
            const buffer = await readFile(
              new URL(`../public/art/frog/image${n}.png`, import.meta.url),
            );
            const meta = await sharp(buffer).metadata(),
              scale = Math.min(1.5 / meta.width!, 1.25 / meta.height!);
            return {
              data: `image/png;base64,${(await sharp(buffer).resize(250, 220, { fit: "inside" }).png().toBuffer()).toString("base64")}`,
              w: meta.width! * scale,
              h: meta.height! * scale,
            };
          }),
        )
      : [];
  const custom = new Map<string, string>();
  for (const id of new Set(
    [
      spec.media.backgroundId,
      ...(spec.kind === "journey"
        ? spec.content.stages.map((s) => s.backgroundId)
        : []),
    ].filter((id): id is string => !!id),
  )) {
    const source = assets.get(id);
    if (!source) throw new Error("Thiếu ảnh nền.");
    const opaque =
      !(await sharp(source).metadata()).hasAlpha && spec.media.fit === "cover";
    const cropped = await cropBackground(source, spec.media),
      prepared = opaque
        ? await sharp(cropped).jpeg({ quality: 82 }).toBuffer()
        : await sharp(cropped)
            .png({ palette: true, quality: 80, effort: 3 })
            .toBuffer();
    custom.set(
      id,
      `image/${opaque ? "jpeg" : "png"};base64,${prepared.toString("base64")}`,
    );
  }
  const character = spec.media.characterId
    ? assets.get(spec.media.characterId)
    : await readFile(
        new URL(
          `../public/art/${spec.kind === "clever_frog" ? "frog/image20" : spec.kind === "picture_reveal" ? "explorer-girl" : "explorer"}.png`,
          import.meta.url,
        ),
      );
  if (!character)
    throw new Error(
      "Không tải được nhân vật đã chọn. Hãy chọn lại ảnh trước khi xuất.",
    );
  const characterSize = await sharp(character).metadata();
  const characterScale = Math.min(
    1.35 / characterSize.width!,
    1.8 / characterSize.height!,
  );
  const characterWidth = characterSize.width! * characterScale;
  const characterHeight = characterSize.height! * characterScale;
  const characterData = character
    ? `image/png;base64,${(await sharp(character).resize(250, 300, { fit: "inside" }).png().toBuffer()).toString("base64")}`
    : undefined;
  const ids = new Map(nodes.map((node, i) => [node.id, i + 1]));
  const pictureCache = new Map<string, string>();
  for (const node of nodes) {
    const slide = pptx.addSlide();
    slide.background = { color: "E9F5FF" };
    slide.addImage({
      data: frogScene || scenes[node.scene % scenes.length],
      x: 0,
      y: 0,
      w: 13.333,
      h: 7.5,
    });
    slide.addImage({
      data:
        custom.get(
          (spec.kind === "journey"
            ? spec.content.stages[node.scene].backgroundId
            : undefined) ||
            spec.media.backgroundId ||
            "",
        ) ||
        frogScene ||
        scenes[node.scene % scenes.length],
      x: 0,
      y: 0,
      w: 13.333,
      h: 7.5,
      transparency: 100 * (1 - spec.media.opacity),
    });
    spec.settings.teams.slice(0, 4).forEach((name, i) => {
      slide.addText(name + " : ____", {
        x: 0.35,
        y: 2.2 + i * 0.7,
        w: 2.15,
        h: 0.55,
        fontSize: 16,
        color: "183D63",
        fill: { color: "E9F6FF" },
        margin: 0.08,
        fit: "shrink",
      });
    });
    slide.addText(
      spec.settings.timerSeconds
        ? "Thời gian: " + spec.settings.timerSeconds + " s"
        : "Không giới hạn giờ",
      {
        x: 0.35,
        y: 0.65,
        w: 2.15,
        h: 0.55,
        fontSize: 15,
        color: "183D63",
        fill: { color: "FFFFFF" },
        align: "center",
        fit: "shrink",
      },
    );
    if (!node.frogs)
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 2.8,
        y: 1.8,
        w: 8.7,
        h: node.word || node.picture || node.revealAnswer ? 4.3 : 2.35,
        fill: {
          color: spec.appearance?.question.slice(1) || "FFF4DE",
          transparency: 0,
        },
        line: { color: "C18D47", width: 3 },
      });
    slide.addText(node.title, {
      fill: { color: spec.appearance?.heading.slice(1) || "A2602C" },
      fontFace: spec.appearance?.font,
      x: 2.8,
      y: 0.65,
      w: 8.7,
      h: 0.75,
      fontSize: 28,
      bold: true,
      color: spec.appearance?.text.slice(1) || "FFF2C9",
      align: "center",
      breakLine: false,
    });
    if (node.text)
      slide.addText(node.text, {
        fontFace: spec.appearance?.font,
        x: 3.05,
        y: 2.05,
        w: 8.2,
        h: node.revealAnswer
          ? node.imageId
            ? 1
            : 2.6
          : node.word?.phrase
            ? 1
            : node.buttons.length === 4
              ? 1.4
              : 2.5,
        fontSize: node.revealAnswer ? 22 : 26,
        color: spec.appearance?.text.slice(1) || "223044",
        align: "center",
        valign: "middle",
        fit: "shrink",
      });
    if (node.word) {
      const chars = Array.from(node.word.phrase.normalize("NFC")),
        columns = Math.min(20, chars.length),
        cell = Math.min(0.62, 8 / columns);
      chars.forEach((c, i) =>
        slide.addText(
          node.word!.letters.includes(letterKey(c)) || !/\p{L}/u.test(c)
            ? c
            : "",
          {
            shape: pptx.ShapeType.roundRect,
            x: 3.1 + (i % columns) * cell,
            y: 3 + Math.floor(i / columns) * 0.55,
            w: cell - 0.05,
            h: 0.5,
            fill: { color: spec.appearance?.question.slice(1) || (/\p{L}/u.test(c) ? "E0F2FF" : "FFF4DE") },
            line: { color: "77B7DF", transparency: /\p{L}/u.test(c) ? 0 : 100 },
            fontSize: 24,
            bold: true,
            color: spec.appearance?.text.slice(1) || "144F89",
            align: "center",
            valign: "middle",
          },
        ),
      );
    }
    if (node.picture) {
      const image = assets.get(node.picture.imageId);
      if (!image) throw new Error("Thiếu ảnh bí mật.");
      if (!pictureCache.has(node.picture.imageId))
        pictureCache.set(
          node.picture.imageId,
          `image/png;base64,${(await sharp(image).resize(960, 540, { fit: "cover" }).png().toBuffer()).toString("base64")}`,
        );
      slide.addImage({
        data: pictureCache.get(node.picture.imageId)!,
        x: 3.5,
        y: 1.7,
        w: 6.3,
        h: 3.5,
      });
      const cols = node.picture.size === 9 ? 3 : 2,
        rows = node.picture.size / cols;
      for (let tile = node.picture.opened; tile < node.picture.size; tile++)
        slide.addText(String(tile + 1), {
          shape: pptx.ShapeType.rect,
          x: 3.5 + ((tile % cols) * 6.3) / cols,
          y: 1.7 + (Math.floor(tile / cols) * 3.5) / rows,
          w: 6.3 / cols,
          h: 3.5 / rows,
          fill: { color: spec.appearance?.answer.slice(1) || "F9CE7C" },
          line: { color: "B88039", width: 2 },
          fontSize: 30,
          color: spec.appearance?.text.slice(1) || "704517",
          align: "center",
          valign: "middle",
          objectName: `puzzle-tile-${tile}`,
          hyperlink: { slide: ids.get(`q-${tile}`)! },
        });
    }
    if (node.frogs) {
      node.frogs.forEach(({ label, index }) => {
        const x = 2.9 + (index % 5) * 1.72,
          y = 2.0 + Math.floor(index / 5) * 1.7;
        const frog = frogImages[index];
        slide.addImage({
          ...frog,
          x: x + (1.5 - frog.w) / 2,
          y: y + (1.25 - frog.h) / 2,
          objectName: `puzzle-tile-${index}`,
          hyperlink: { slide: ids.get(`q-${index}`)! },
        });
        slide.addText(label, {
          objectName: `frog-label-${index}`,
          x,
          y: y + 1.2,
          w: 1.5,
          h: 0.4,
          fontSize: 15,
          bold: true,
          fontFace: spec.appearance?.font || "Roboto",
          color: "195A2A",
          fill: { color: "FFF9D6" },
          align: "center",
          fit: "shrink",
          hyperlink: { slide: ids.get(`q-${index}`)! },
        });
      });
    }
    if (node.imageId) {
      const image = assets.get(node.imageId);
      if (!image) throw new Error("Thiếu ảnh câu hỏi.");
      const resized = await sharp(image)
          .resize(700, 250, { fit: "inside" })
          .png()
          .toBuffer({ resolveWithObject: true }),
        scale = Math.min(4.3 / resized.info.width, 1.4 / resized.info.height),
        width = resized.info.width * scale,
        height = resized.info.height * scale;
      slide.addImage({
        data: `image/png;base64,${resized.data.toString("base64")}`,
        x: 4.5 + (4.3 - width) / 2,
        y: 3 + (1.4 - height) / 2,
        w: width,
        h: height,
      });
    }
    node.buttons.forEach((button, i) => {
      const multiple = node.buttons.length === 4;
      const x = multiple ? 2.8 + (i % 2) * 4.5 : 4.3,
        y = multiple
          ? 4.5 + Math.floor(i / 2) * 0.9
          : node.revealAnswer
            ? 6.05
            : 5.3,
        w = multiple ? 4.2 : 4.7;
      const slideNumber = ids.get(button.target);
      if (!slideNumber) throw new Error("Liên kết slide không tồn tại.");
      slide.addText(button.text, {
        shape: pptx.ShapeType.roundRect,
        x,
        y,
        w,
        h: 0.75,
        fontSize: 22,
        bold: true,
        fontFace: spec.appearance?.font,
        color: spec.appearance?.text.slice(1) || "4B2D10",
        fill: { color: spec.appearance?.answer.slice(1) || "FFD88A" },
        line: { color: "B57935", width: 2 },
        align: "center",
        valign: "middle",
        fit: "shrink",
        hyperlink: { slide: slideNumber },
        objectName: node.revealAnswer ? "puzzle-return" : undefined,
      });
    });
    if (node.revealAnswer) {
      slide.addText("Hiện đáp án", {
        objectName: "puzzle-answer-button",
        x: 3.05,
        y: 4.8,
        w: 2.3,
        h: 0.6,
        shape: pptx.ShapeType.roundRect,
        fill: { color: "FFD88A" },
        color: "4B2D10",
        fontSize: 18,
        bold: true,
        align: "center",
      });
      slide.addText(node.revealAnswer, {
        objectName: "puzzle-answer",
        x: 5.55,
        y: 4.75,
        w: 5.6,
        h: 1.1,
        fill: { color: "E0F4DD" },
        color: "20552D",
        fontSize: 18,
        fontFace: spec.appearance?.font,
        margin: 0.12,
        fit: "shrink",
      });
    }
    slide.addText("EduGame Studio · Giáo viên quản lý điểm và thời gian", {
      x: 0.9,
      y: 6.7,
      w: 11.5,
      h: 0.2,
      fontSize: 10,
      color: "5D7185",
      align: "center",
    });
    if (characterData)
      slide.addImage({
        objectName: "game-character",
        data: characterData,
        x: 11.6 + (1.35 - characterWidth) / 2,
        y: 6 - characterHeight,
        w: characterWidth,
        h: characterHeight,
      });
  }
  const rawOutput = (await pptx.write({
    outputType: "nodebuffer",
    compression: true,
  })) as Buffer;
  let output = await addPowerPointMotion(
    rawOutput,
    spec.settings.reducedMotion,
  );
  if (spec.kind === "picture_reveal" || spec.kind === "clever_frog")
    output = await addPictureInteraction(
      output,
      spec.kind === "clever_frog"
        ? spec.content.questions.length
        : spec.content.size,
      spec.settings.reducedMotion,
    );
  if (output.length > 50 * 1024 * 1024)
    throw new Error("File PowerPoint vượt 50 MB.");
  return output;
}

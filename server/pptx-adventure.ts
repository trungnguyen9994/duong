import pptxgen from "pptxgenjs";
import JSZip from "jszip";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { adventureConfig, isAdventure } from "../src/domain/adventure-config";
import { playableErrors, type StudioSpec } from "../src/domain/studio-spec";
import { addPictureInteraction } from "./pptx-picture";
export function adventureSlides(spec: StudioSpec) {
  if (!isAdventure(spec.kind)) throw Error("Sai mẫu trò chơi.");
  const errors = playableErrors(spec);
  if (errors.length) throw Error(errors.join(" "));
  const questions = "questions" in spec.content ? spec.content.questions : [];
  return [
    {
      id: "cover",
      title: spec.metadata.title,
      text: adventureConfig[spec.kind].instructions,
      buttons: [
        { text: "Bắt đầu", target: spec.kind === "football" ? "q-0" : "board" },
      ],
      scene: 0,
    },
    ...(spec.kind === "football"
      ? []
      : [
          {
            id: "board",
            title: spec.metadata.title,
            text: "",
            buttons: [{ text: "Hoàn thành", target: "summary" }],
            scene: 0,
          },
        ]),
    ...questions.map((q, i) => ({
      id: `q-${i}`,
      title: q.label || `Câu ${i + 1}`,
      text: q.prompt,
      buttons: [
        {
          text: spec.kind === "football" ? "Câu tiếp theo" : "Quay lại bảng",
          target:
            spec.kind === "football"
              ? i + 1 < questions.length
                ? `q-${i + 1}`
                : "summary"
              : "board",
        },
      ],
      scene: 0,
    })),
    {
      id: "summary",
      title: "Chúc mừng cả lớp!",
      text: "Cùng tổng kết điểm và khen ngợi cả lớp.",
      buttons: [{ text: "Về trang đầu", target: "cover" }],
      scene: 0,
    },
  ];
}
export async function renderAdventurePptx(
  spec: StudioSpec,
  assets: Map<string, Buffer>,
): Promise<Buffer> {
  if (!isAdventure(spec.kind) || !("questions" in spec.content))
    throw Error("Sai mẫu.");
  const config = adventureConfig[spec.kind],
    nodes = adventureSlides(spec),
    pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = spec.metadata.title;
  pptx.author = "EduGame Studio";
  pptx.theme = {
    headFontFace: spec.appearance?.font || "Roboto",
    bodyFontFace: spec.appearance?.font || "Roboto",
  };
  const images = new Map<string, { data: string; w: number; h: number }>();
  const image = async (path: string) => {
    if (images.has(path)) return images.get(path)!;
    const source = await readFile(new URL(`../public${path}`, import.meta.url)),
      meta = await sharp(source).metadata();
    const result = {
      data: `image/png;base64,${(await sharp(source).resize(1280, 720, { fit: "inside", withoutEnlargement: true }).png().toBuffer()).toString("base64")}`,
      w: meta.width!,
      h: meta.height!,
    };
    images.set(path, result);
    return result;
  };
  const ids = new Map(nodes.map((n, i) => [n.id, i + 1]));
  for (const node of nodes) {
    const slide = pptx.addSlide();
    slide.background = {
      color: spec.kind === "boat_rescue" ? "65C6ED" : "D7EDC8",
    };
    const addArt = async (
      path: string,
      x: number,
      y: number,
      w: number,
      h: number,
      name?: string,
      target?: number,
    ) => {
      const im = await image(path),
        scale = Math.min(w / im.w, h / im.h);
      slide.addImage({
        data: im.data,
        x: x + (w - im.w * scale) / 2,
        y: y + (h - im.h * scale) / 2,
        w: im.w * scale,
        h: im.h * scale,
        objectName: name,
        hyperlink: target ? { slide: target } : undefined,
      });
    };
    if (config.background) {
      const im = await image(config.background);
      slide.addImage({ data: im.data, x: 0, y: 0, w: 13.333, h: 7.5 });
    }
    if (spec.media.backgroundId) {
      const source = assets.get(spec.media.backgroundId);
      if (!source) throw Error("Thiếu ảnh nền.");
      const { cropBackground } = await import("./pptx");
      slide.addImage({
        data: `image/png;base64,${(await cropBackground(source, spec.media)).toString("base64")}`,
        x: 0,
        y: 0,
        w: 13.333,
        h: 7.5,
        transparency: 100 * (1 - spec.media.opacity),
      });
    }
    if (spec.kind === "boat_rescue") {
      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: 2.0,
        h: 7.5,
        fill: { color: "E3C18A" },
        line: { transparency: 100 },
      });
      await addArt("/art/boat_rescue/image1.gif", 9.5, 0.1, 2.5, 1.0);
      slide.addText("BỜ AN TOÀN", {
        x: 0.2,
        y: 4.6,
        w: 1.6,
        h: 1,
        fontSize: 20,
        bold: true,
        color: "5A4923",
        align: "center",
      });
    }
    slide.addText(node.title, {
      x: 2.25,
      y: 0.3,
      w: 9.6,
      h: 0.7,
      fontSize: 30,
      bold: true,
      color: spec.appearance?.text.slice(1) || "16472B",
      fill: { color: spec.appearance?.heading.slice(1) || "FFF4CB" },
      align: "center",
      fit: "shrink",
    });
    spec.settings.teams
      .slice(0, 4)
      .forEach((name, i) =>
        slide.addText(`${name}: ____`, {
          x: 0.2,
          y: 1.3 + i * 0.6,
          w: 1.8,
          h: 0.45,
          fontSize: 13,
          fill: { color: "FFFFFF" },
          color: "193C52",
          fit: "shrink",
        }),
      );
    slide.addText(
      spec.settings.timerSeconds
        ? `Thời gian: ${spec.settings.timerSeconds}s`
        : "Không giới hạn giờ",
      {
        x: 0.2,
        y: 6.2,
        w: 1.8,
        h: 0.55,
        fontSize: 13,
        fill: { color: "FFFFFF" },
        color: "193C52",
        fit: "shrink",
      },
    );
    if (node.id === "board") {
      for (let i = 0; i < spec.content.questions.length; i++) {
        const q = spec.content.questions[i],
          cols = spec.kind === "forest_rescue" ? 4 : 3,
          x = 2.5 + (i % cols) * (spec.kind === "forest_rescue" ? 2.4 : 3),
          y = 1.9 + Math.floor(i / cols) * 2.0;
        await addArt(
          config.objects[i % config.objects.length],
          x,
          y,
          2,
          1.6,
          spec.kind === "forest_rescue" ? `animal-${i}` : `puzzle-tile-${i}`,
          spec.kind === "forest_rescue" ? undefined : ids.get(`q-${i}`),
        );
        if (spec.kind === "forest_rescue")
          await addArt(
            "/art/forest-rescue/image17.png",
            x,
            y,
            2,
            1.6,
            `puzzle-tile-${i}`,
            ids.get(`q-${i}`),
          );
        slide.addText(q.label || `Thử thách ${i + 1}`, {
          objectName: `frog-label-${i}`,
          x,
          y: y + 1.6,
          w: 2,
          h: 0.4,
          fontSize: 17,
          fill: { color: "FFF4CB" },
          color: "194A2C",
          align: "center",
          hyperlink: { slide: ids.get(`q-${i}`)! },
        });
      }
    } else if (node.id.startsWith("q-")) {
      const i = Number(node.id.slice(2)),
        q = spec.content.questions[i];
      slide.addText(q.prompt, {
        x: 2.3,
        y: 1.25,
        w: 9.6,
        h: q.imageId ? 1 : 1.6,
        fontSize: 28,
        align: "center",
        valign: "middle",
        fill: { color: spec.appearance?.question.slice(1) || "FFFBE7" },
        color: spec.appearance?.text.slice(1) || "193C52",
        fit: "shrink",
      });
      if (q.imageId) {
        const source = assets.get(q.imageId);
        if (!source) throw Error("Thiếu ảnh câu hỏi.");
        const meta = await sharp(source).metadata(),
          s = Math.min(3 / meta.width!, 1.3 / meta.height!);
        slide.addImage({
          data: `image/png;base64,${(await sharp(source).resize(700, 300, { fit: "inside" }).png().toBuffer()).toString("base64")}`,
          x: 5.5,
          y: 2.25,
          w: meta.width! * s,
          h: meta.height! * s,
        });
      }
      if (config.oral) {
        slide.addText("Hiện đáp án", {
          objectName: "puzzle-answer-button",
          x: 2.5,
          y: 3.25,
          w: 2.6,
          h: 0.6,
          fontSize: 20,
          fill: { color: "FFE19B" },
          color: "4A3A17",
          align: "center",
        });
        slide.addText(
          `Đáp án: ${q.choices[q.correct]}${q.explanation ? "\n" + q.explanation : ""}`,
          {
            objectName: "puzzle-answer",
            x: 5.25,
            y: 3.1,
            w: 6.4,
            h: 1.1,
            fontSize: 21,
            fill: { color: "DEF7D1" },
            color: "16472B",
            fit: "shrink",
          },
        );
        slide.addText("Trả lời đúng · Mở lồng", {
          objectName: "rescue-control",
          x: 3,
          y: 4.7,
          w: 4.5,
          h: 0.55,
          fontSize: 20,
          fill: { color: "FFE19B" },
          color: "19462A",
          align: "center",
        });
        slide.addText("Đã giải cứu!", {
          objectName: "correct-feedback",
          x: 7.8,
          y: 4.7,
          w: 3.5,
          h: 0.55,
          fontSize: 22,
          fill: { color: "FFFFFF" },
          color: "147527",
          align: "center",
        });
      } else {
        q.choices
          .slice(0, config.choices)
          .forEach((choice, j) =>
            slide.addText(`${"ABCD"[j]}. ${choice}`, {
              objectName: `choice-${j}`,
              x: 2.35 + (j % 2) * 4.9,
              y: 3.1 + Math.floor(j / 2) * 0.75,
              w: 4.6,
              h: 0.6,
              fontSize: 21,
              fill: { color: spec.appearance?.answer.slice(1) || "FFE19B" },
              color: spec.appearance?.text.slice(1) || "193C52",
              align: "center",
              fit: "shrink",
            }),
          );
        // Also allow a teacher to show the answer explicitly, like the source decks.
        slide.addText("Hiện đáp án", {
          objectName: "puzzle-answer-button",
          x: 2.4,
          y: 5.15,
          w: 2.5,
          h: 0.45,
          fontSize: 16,
          fill: { color: "FFFFFF" },
          color: "16472B",
          align: "center",
        });
        slide.addText(`Đáp án: ${"ABCD"[q.correct]}. ${q.choices[q.correct]}`, {
          objectName: "puzzle-answer",
          x: 5,
          y: 5.1,
          w: 6.5,
          h: 0.55,
          fontSize: 19,
          fill: { color: "E1F6D5" },
          color: "16472B",
          fit: "shrink",
        });
        slide.addText("Chính xác!", {
          objectName: "correct-feedback",
          x: 5.5,
          y: 4.65,
          w: 3.0,
          h: 0.45,
          fontSize: 22,
          bold: true,
          color: "147527",
          fill: { color: "FFFFFF" },
          align: "center",
        });
        slide.addText(q.hint || "Chưa đúng, thử lại nhé!", {
          objectName: "wrong-feedback",
          x: 5,
          y: 4.65,
          w: 6.5,
          h: 0.45,
          fontSize: 19,
          color: "B02E27",
          fill: { color: "FFFFFF" },
          align: "center",
          fit: "shrink",
        });
      }
      await addArt(
        config.objects[i % config.objects.length],
        spec.kind === "football" ? 6.2 : 9.5,
        5.8,
        spec.kind === "football" ? 0.6 : 1.4,
        1,
        "adventure-actor",
      );
      if (spec.kind === "football")
        await addArt(
          "/art/football/image4.png",
          6.3,
          4.95,
          0.7,
          0.8,
          "game-character",
        );
      if (spec.kind === "forest_rescue")
        await addArt(
          "/art/forest-rescue/image17.png",
          9.5,
          5.8,
          1.4,
          1,
          "adventure-cage",
        );
    } else {
      slide.addText(node.text, {
        x: 2.4,
        y: 1.65,
        w: 9.4,
        h: 2.4,
        fontSize: 27,
        fill: { color: "FFFBE7" },
        color: "19462A",
        align: "center",
        fit: "shrink",
      });
      await addArt(config.objects[0], 5.5, 4, 2, 1.5, "game-character");
    }
    for (const b of node.buttons)
      slide.addText(b.text, {
        objectName: node.id.startsWith("q-") ? "puzzle-return" : undefined,
        x: 4.5,
        y: 6.9,
        w: 4.5,
        h: 0.45,
        fontSize: 19,
        fill: { color: "FFF4CB" },
        color: "16472B",
        align: "center",
        hyperlink: { slide: ids.get(b.target)! },
      });
    slide.addNotes(
      `Mẫu tham khảo do người dùng cung cấp. ${spec.kind === "boat_rescue" ? "Mẫu thuyền: Phan Thị Linh." : ""} Giáo viên điều khiển chấm điểm và thời gian; mở trong Slide Show để dùng animation và nút bấm.`,
    );
  }
  let output = (await pptx.write({
    outputType: "nodebuffer",
    compression: true,
  })) as Buffer;
  if (spec.kind !== "football")
    output = await addPictureInteraction(
      output,
      spec.content.questions.length,
      spec.settings.reducedMotion,
    );
  output = await addAdventureAnimations(output, spec);
  if (output.length > 50 * 1024 * 1024)
    throw Error("File PowerPoint vượt 50 MB.");
  return output;
}

async function addAdventureAnimations(input: Buffer, spec: StudioSpec) {
  if (!isAdventure(spec.kind) || !("questions" in spec.content)) throw Error();
  const zip = await JSZip.loadAsync(input),
    config = adventureConfig[spec.kind];
  const offset = spec.kind === "football" ? 2 : 3;
  for (let i = 0; i < spec.content.questions.length; i++) {
    const path = `ppt/slides/slide${i + offset}.xml`;
    let xml = await zip.file(path)!.async("string");
    const objects = [...xml.matchAll(/<p:(sp|pic)>[\s\S]*?<\/p:\1>/g)];
    const find = (name: string) =>
      objects
        .find((m) => m[0].includes(`name="${name}"`))?.[0]
        .match(/<p:cNvPr\b[^>]*id="(\d+)"/)?.[1];
    let id =
      Math.max(
        1,
        ...[...xml.matchAll(/<p:cTn id="(\d+)"/g)].map((m) => Number(m[1])),
      ) + 1;
    const tgt = (shape: string) =>
      `<p:tgtEl><p:spTgt spid="${shape}"/></p:tgtEl>`;
    let effects = "";
    const feedback = (button: string, shape: string, correct: boolean) => {
      const sequence = id++,
        effect = id++;
      let body = `<p:set><p:cBhvr><p:cTn id="${id++}" dur="1" fill="hold"/>${tgt(shape)}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>`;
      if (!spec.settings.reducedMotion)
        body += `<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${id++}" dur="200"/>${tgt(shape)}</p:cBhvr></p:animEffect>`;
      // Hide the opposite result so trying another choice replaces the feedback.
      const opposite = find(correct ? "wrong-feedback" : "correct-feedback");
      if (opposite)
        body += `<p:set><p:cBhvr><p:cTn id="${id++}" dur="1" fill="hold"/>${tgt(opposite)}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="hidden"/></p:to></p:set>`;
      const actor = find("adventure-actor");
      if (actor && !spec.settings.reducedMotion) {
        const route =
          spec.kind === "football"
            ? correct
              ? "M 0 0 L 0 -0.17 E"
              : "M 0 0 L 0.28 -0.12 E"
            : spec.kind === "boat_rescue"
              ? "M 0 0 L -0.55 0 E"
              : "M 0 0 L 0.15 0 E";
        if (correct || spec.kind === "football")
          body += `<p:animMotion origin="layout" path="${route}" pathEditMode="relative"><p:cBhvr><p:cTn id="${id++}" dur="800" fill="hold"/>${tgt(actor)}</p:cBhvr></p:animMotion>`;
      }
      effects += `<p:seq concurrent="1" nextAc="none"><p:cTn id="${sequence}" restart="always" nodeType="interactiveSeq"><p:stCondLst><p:cond evt="onClick" delay="0">${tgt(button)}</p:cond></p:stCondLst><p:childTnLst><p:par><p:cTn id="${effect}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" nodeType="clickEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${body}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:seq>`;
    };
    if (config.oral) {
      const button = find("rescue-control"),
        answer = find("correct-feedback");
      if (button && answer) feedback(button, answer, true);
      const cage = find("adventure-cage");
      if (cage && button) {
        const hidden = `<p:par><p:cTn id="${id++}" dur="indefinite"><p:stCondLst><p:cond evt="onClick" delay="0">${tgt(button)}</p:cond></p:stCondLst><p:childTnLst><p:set><p:cBhvr><p:cTn id="${id++}" dur="1" fill="hold"/>${tgt(cage)}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="hidden"/></p:to></p:set></p:childTnLst></p:cTn></p:par>`;
        effects += hidden;
      }
    } else {
      for (let j = 0; j < config.choices; j++) {
        const button = find(`choice-${j}`),
          result = find(
            j === spec.content.questions[i].correct
              ? "correct-feedback"
              : "wrong-feedback",
          );
        if (button && result)
          feedback(button, result, j === spec.content.questions[i].correct);
      }
      if (spec.kind === "football") {
        const button = find("puzzle-answer-button"),
          answer = find("puzzle-answer");
        if (button && answer) feedback(button, answer, true);
      }
    }
    if (xml.includes("<p:timing>"))
      xml = xml.replace(
        /(<p:cTn id="1"[^>]*>[\s\S]*?<p:childTnLst>)/,
        `$1${effects}`,
      );
    else
      xml = xml.replace(
        "</p:sld>",
        `<p:transition advClick="0"/><p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>${effects}</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing></p:sld>`,
      );
    zip.file(path, xml);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

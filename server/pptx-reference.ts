import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import {
  questionsOf,
  playableErrors,
  type StudioSpec,
} from "../src/domain/studio-spec";

const supported = [
  "doremon_travel",
  "picture_reveal",
  "clever_frog",
  "boat_rescue",
  "football",
  "forest_rescue",
];
export const hasReferenceTemplate = (spec: StudioSpec) =>
  supported.includes(spec.kind) &&
  (spec.kind !== "picture_reveal" || spec.content.size === 6);
const escape = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
function shapes(xml: string) {
  return [...xml.matchAll(/<p:(sp|pic)>[\s\S]*?<\/p:\1>/g)].map((m) => m[0]);
}
function shapeId(shape: string) {
  return shape.match(/<p:cNvPr\b[^>]*id="(\d+)"/)?.[1];
}
function textOf(shape: string) {
  return [...shape.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
    .map((m) => m[1])
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}
function replaceText(xml: string, id: string, text: string, font?: string) {
  return xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, (shape) => {
    if (shapeId(shape) !== id) return shape;
    return shape.replace(
      /<p:txBody>([\s\S]*?)<\/p:txBody>/,
      (_, body: string) => {
        const properties =
          body.match(
            /<a:bodyPr\b[^>]*\/>|<a:bodyPr\b[\s\S]*?<\/a:bodyPr>/,
          )?.[0] || "<a:bodyPr/>";
        const paragraph =
          body.match(/<a:pPr\b[^>]*\/>|<a:pPr\b[\s\S]*?<\/a:pPr>/)?.[0] ||
          '<a:pPr algn="ctr"/>';
        let run =
          body.match(/<a:rPr\b[^>]*\/>|<a:rPr\b[\s\S]*?<\/a:rPr>/)?.[0] ||
          '<a:rPr lang="vi-VN" sz="2400"/>';
        if (font) {
          run = run.replace(/<a:(latin|ea|cs)\b[^>]*\/>/g, "");
          run = run.endsWith("/>")
            ? run.slice(0, -2) +
              `><a:latin typeface="${escape(font)}"/></a:rPr>`
            : run.replace(
                "</a:rPr>",
                `<a:latin typeface="${escape(font)}"/></a:rPr>`,
              );
        }
        const lines = text
          .split("\n")
          .map(
            (line) =>
              `<a:p>${paragraph}<a:r>${run}<a:t>${escape(line)}</a:t></a:r><a:endParaRPr lang="vi-VN"/></a:p>`,
          )
          .join("");
        return `<p:txBody>${properties}<a:lstStyle/>${lines}</p:txBody>`;
      },
    );
  });
}
function remapShapes(xml: string, a: string, b: string) {
  if (a === b) return xml;
  return xml.replace(/spid="(\d+)"/g, (full, id: string) =>
    id === a ? `spid="${b}"` : id === b ? `spid="${a}"` : full,
  );
}
function styleShape(
  xml: string,
  id: string,
  spec: StudioSpec,
  role: "heading" | "question" | "answer",
) {
  const theme = spec.appearance;
  if (!theme) return xml;
  return xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, (shape) => {
    if (shapeId(shape) !== id) return shape;
    const solid = (value: string) =>
      `<a:solidFill><a:srgbClr val="${value.slice(1)}"/></a:solidFill>`;
    shape = shape.replace(/<p:spPr>([\s\S]*?)<\/p:spPr>/, (_, body: string) => {
      const boundary = body.search(
          /<a:(ln|effectLst|effectDag|scene3d|sp3d|extLst)\b/,
        ),
        prefix = boundary < 0 ? body : body.slice(0, boundary),
        suffix = boundary < 0 ? "" : body.slice(boundary);
      return `<p:spPr>${prefix.replace(/<a:(solidFill|gradFill|pattFill|blipFill)\b[^>]*>[\s\S]*?<\/a:\1>/g, "").replace(/<a:(noFill|grpFill)\s*\/>/g, "")}${solid(theme[role])}${suffix}</p:spPr>`;
    });
    return shape.replace(
      /<a:(rPr|defRPr|endParaRPr)\b([^>]*)(?:\/>|>([\s\S]*?)<\/a:\1>)/g,
      (_, tag: string, attrs: string, body = "") => {
        body = body
          .replace(/<a:(solidFill|gradFill)\b[^>]*>[\s\S]*?<\/a:\1>/g, "")
          .replace(/<a:(latin|ea|cs)\b[^>]*\/>/g, "");
        return `<a:${tag}${attrs}>${body}${solid(theme.text)}<a:latin typeface="${escape(theme.font)}"/><a:ea typeface="${escape(theme.font)}"/><a:cs typeface="${escape(theme.font)}"/></a:${tag}>`;
      },
    );
  });
}
function biggestPicture(xml: string) {
  return shapes(xml)
    .filter((s) => s.startsWith("<p:pic>"))
    .map((s) => ({
      s,
      area:
        Number(s.match(/<a:ext\b[^>]*cx="(\d+)"/)?.[1] || 0) *
        Number(s.match(/<a:ext\b[^>]*cy="(\d+)"/)?.[1] || 0),
    }))
    .sort((a, b) => b.area - a.area)[0]?.s;
}
/** Edit native templates in-place: media, masters, object IDs and timing remain intact. */
export async function renderReferencePptx(
  spec: StudioSpec,
  assets: Map<string, Buffer>,
) {
  const errors = playableErrors(spec);
  if (errors.length) throw Error(errors.join(" "));
  const zip = await JSZip.loadAsync(
    await readFile(new URL(`./templates/${spec.kind}.pptx`, import.meta.url)),
  );
  if (spec.kind === "doremon_travel") {
    async function replacePicture(slide: number, rid: string, assetId?: string, scene = false) {
      if (!assetId) return;
      const data = assets.get(assetId);
      if (!data) throw Error("Thiếu ảnh đã chọn.");
      const file = `doremon-${slide}-${rid}.png`;
      const prepared = scene
        ? await (await import("./pptx")).cropBackground(data, spec.media, { width: 1600, height: 1000 })
        : await sharp(data).png().toBuffer();
      zip.file(`ppt/media/${file}`, prepared);
      const path = `ppt/slides/_rels/slide${slide}.xml.rels`;
      let rels = await zip.file(path)!.async("string");
      rels = rels.replace(/<Relationship\b[^>]*\/>/g, rel => rel.includes(`Id="${rid}"`) ? rel.replace(/Target="[^"]*"/, `Target="../media/${file}"`) : rel);
      zip.file(path, rels);
    }
    let cover = await zip.file("ppt/slides/slide1.xml")!.async("string");
    cover = replaceText(cover, "2", spec.metadata.title, "Arial");
    cover = replaceText(cover, "3", "Mẫu tham khảo: Huyen Trang", "Arial");
    cover = styleShape(cover, "2", spec, "heading");
    zip.file("ppt/slides/slide1.xml", cover);
    await replacePicture(1, "rId3", spec.media.backgroundId, true);
    const titles = ["2", "28", "27", "28"], places = ["22", "25", "26", "26"];
    const correctShapes = ["18", "19", "19", "18"], wrongShapes = ["19", "20", "20", "19"];
    const defaultCorrect = [1, 0, 0, 1];
    for (let i = 0; i < 4; i++) {
      const q = spec.content.questions[i], path = `ppt/slides/slide${i + 2}.xml`;
      let xml = await zip.file(path)!.async("string");
      xml = replaceText(xml, titles[i], `${q.prompt}\nA. ${q.choices[0]}\nB. ${q.choices[1]}`, spec.appearance?.font || "Arial");
      // The original uses grouped buttons for A and B. Swap only click triggers,
      // preserving animation targets, motion paths, media and all sound timings.
      if (q.correct !== defaultCorrect[i]) {
        const a = i === 0 || i === 3 ? "8" : "9", b = "15";
        xml = xml.replace(/<p:cond\b[^>]*evt="onClick"[\s\S]*?<\/p:cond>/g, condition => condition.replace(/spid="(\d+)"/g, (match, id: string) => id === a ? `spid="${b}"` : id === b ? `spid="${a}"` : match));
      }
      xml = replaceText(xml, correctShapes[i], "Chính xác!", "Arial");
      xml = replaceText(xml, wrongShapes[i], "Chưa đúng!", "Arial");
      xml = replaceText(xml, places[i], `${q.label || ["Cầu sông Hàn", "Cầu Rồng", "Công viên châu Á", "Cầu Tình yêu"][i]}\nĐà Nẵng, Việt Nam`, "Arial");
      xml = styleShape(xml, titles[i], spec, "question");
      xml = styleShape(xml, correctShapes[i], spec, "answer");
      xml = styleShape(xml, wrongShapes[i], spec, "answer");
      xml = styleShape(xml, places[i], spec, "heading");
      await replacePicture(i + 2, "rId6", spec.media.backgroundId, true);
      await replacePicture(i + 2, i === 0 ? "rId16" : "rId9", q.imageId);
      await replacePicture(i + 2, "rId7", spec.media.characterId);
      // Auto-fit long Vietnamese questions rather than clipping the original text box.
      xml = xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => shapeId(shape) === titles[i] ? shape.replace(/<a:bodyPr\s*\/>/, '<a:bodyPr><a:normAutofit/></a:bodyPr>') : shape);
      if (spec.settings.reducedMotion)
        xml = xml.replace(/<p:(animEffect|animMotion|animRot|animScale)\b[^>]*>[\s\S]*?<\/p:\1>/g, "");
      zip.file(path, xml);
    }
    const result = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    if (result.length > 50 * 1024 * 1024) throw Error("File PowerPoint vượt 50 MB.");
    return result;
  }
  const qs = questionsOf(spec),
    football = spec.kind === "football",
    boat = spec.kind === "boat_rescue",
    forest = spec.kind === "forest_rescue",
    board = boat || forest ? 3 : 2;
  const originals = new Map<string, string>();
  for (const path of Object.keys(zip.files))
    if (/^ppt\/slides\/(?:_rels\/)?slide\d+\.xml(?:\.rels)?$/.test(path))
      originals.set(path, await zip.file(path)!.async("string"));
  const sequence = football
    ? [1, ...qs.map(() => 2)]
    : [
        boat || forest ? 2 : 1,
        board,
        ...qs.map((_, i) => (boat || forest ? 4 + i : 3 + i)),
      ];
  let presentation = await zip.file("ppt/presentation.xml")!.async("string");
  const slideRels = await zip
    .file("ppt/_rels/presentation.xml.rels")!
    .async("string");
  let relationships = slideRels.replace(
    /<Relationship\b(?=[^>]*Type="[^"]*\/slide")(?=[^>]*Target="slides\/slide\d+\.xml")[^>]*\/>/g,
    "",
  );
  let content = await zip.file("[Content_Types].xml")!.async("string");
  content = content.replace(
    /<Override\b[^>]*PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>/g,
    "",
  );
  const questionStart = football ? 1 : 2;
  const retained = new Map<number, number>();
  sequence.forEach((original, index) => {
    if (!retained.has(original)) retained.set(original, index + 1);
  });
  const questionTargets = new Map<number, number>();
  for (let i = 0; i < qs.length; i++)
    questionTargets.set(boat || forest ? 4 + i : 3 + i, questionStart + i + 1);
  const getRelPath = (number: number) =>
    `ppt/slides/_rels/slide${number}.xml.rels`;
  for (let index = 0; index < sequence.length; index++) {
    const original = sequence[index],
      number = index + 1;
    let xml = originals.get(`ppt/slides/slide${original}.xml`)!;
    if (!xml) throw Error("Mẫu không có đủ slide câu hỏi.");
    let rels = originals.get(getRelPath(original))!;
    const notes = rels.match(
      /<Relationship\b[^>]*Type="[^"]*\/notesSlide"[^>]*Target="([^"]+)"[^>]*\/>/,
    );
    if (notes) {
      const sourcePath = "ppt/" + notes[1].replace("../", ""),
        baseName = sourcePath.split("/").at(-1)!;
      const name = `gameNotes${number}.xml`,
        noteFile = zip.file(sourcePath),
        noteRels = zip.file(`ppt/notesSlides/_rels/${baseName}.rels`);
      if (noteFile && noteRels) {
        zip.file(`ppt/notesSlides/${name}`, await noteFile.async("string"));
        zip.file(
          `ppt/notesSlides/_rels/${name}.rels`,
          (await noteRels.async("string")).replace(
            /Target="\.\.\/slides\/slide\d+\.xml"/,
            `Target="../slides/slide${number}.xml"`,
          ),
        );
        rels = rels.replace(
          notes[0],
          notes[0].replace(notes[1], `../notesSlides/${name}`),
        );
        content = content.replace(
          "</Types>",
          `<Override PartName="/ppt/notesSlides/${name}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/></Types>`,
        );
      }
    }
    if (index >= questionStart) {
      const q = qs[index - questionStart];
      if (football) {
        xml = xml.includes("<p:transition")
          ? xml.replace(
              /<p:transition\b([^>]*?)(\/?)>/,
              (full, attrs: string, close: string) =>
                `<p:transition${attrs.replace(/\sadvClick="[^"]*"/, "")} advClick="0"${close}>`,
            )
          : xml.replace("<p:timing>", '<p:transition advClick="0"/><p:timing>');
        xml = replaceText(
          xml,
          "15",
          q.prompt,
          spec.appearance?.font || "Roboto",
        );
        const slots = ["8", "10", "9", "11"]; // Native source geometry: top-left, top-right, bottom-left, bottom-right.
        slots.forEach(
          (id, j) =>
            (xml = replaceText(
              xml,
              id,
              `${"ABCD"[j]}. ${q.choices[j]}`,
              spec.appearance?.font || "Roboto",
            )),
        );
        xml = remapShapes(xml, "10", slots[q.correct]);
        // A separate next control avoids background clicks accidentally advancing.
        const next = index + 1 < sequence.length ? number + 1 : 1;
        const nav = `<p:sp><p:nvSpPr><p:cNvPr id="9000" name="Next question"><a:hlinkClick r:id="rIdNextQuestion" action="ppaction://hlinksldjump"/></p:cNvPr><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="7400000" y="100000"/><a:ext cx="1600000" cy="450000"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="vi-VN" sz="1600"/><a:t>${next === 1 ? "Về trang đầu" : "Câu tiếp theo"}</a:t></a:r></a:p></p:txBody></p:sp>`;
        xml = xml.replace("</p:spTree>", nav + "</p:spTree>");
        rels = rels.replace(
          "</Relationships>",
          `<Relationship Id="rIdNextQuestion" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slide${next}.xml"/></Relationships>`,
        );
      } else if (forest) {
        const entries = shapes(xml).filter((s) => !!textOf(s));
        if (entries[0])
          xml = replaceText(
            xml,
            shapeId(entries[0])!,
            q.prompt,
            spec.appearance?.font || "Roboto",
          );
        if (entries[1])
          xml = replaceText(
            xml,
            shapeId(entries[1])!,
            `Đáp án: ${q.choices[q.correct]}${q.explanation ? "\n" + q.explanation : ""}`,
            spec.appearance?.font || "Roboto",
          );
      } else if (boat) {
        const entries = shapes(xml).filter((s) => !!textOf(s));
        const choices = entries.filter((s) => /^[ABC]\s*\./.test(textOf(s)));
        const correct = choices.find((s) => textOf(s).includes("Đ"));
        const desired = choices.find((s) =>
          textOf(s).startsWith("ABC"[q.correct]),
        );
        if (correct && desired)
          xml = remapShapes(xml, shapeId(correct)!, shapeId(desired)!);
        for (const s of entries) {
          const text = textOf(s);
          xml = replaceText(
            xml,
            shapeId(s)!,
            /^[ABC]\s*\./.test(text)
              ? `${text[0]}. ${q.choices["ABC".indexOf(text[0])]}`
              : q.prompt,
            spec.appearance?.font || "Roboto",
          );
        }
      } else {
        const ids = spec.kind === "clever_frog" ? ["13", "14"] : ["6", "5"];
        const prompt =
          q.prompt +
          (spec.kind === "picture_reveal"
            ? "\n" + q.choices.map((c, j) => `${"ABCD"[j]}. ${c}`).join("\n")
            : "");
        xml = replaceText(
          xml,
          ids[0],
          prompt,
          spec.appearance?.font || "Roboto",
        );
        xml = replaceText(
          xml,
          ids[1],
          `Đáp án: ${q.choices[q.correct]}${q.explanation ? "\n" + q.explanation : ""}`,
          spec.appearance?.font || "Roboto",
        );
      }
    }
    const replacements: [string, string | undefined, boolean][] = [];
    if (index >= questionStart && !forest && !boat)
      replacements.push([
        football ? "7" : spec.kind === "clever_frog" ? "12" : "3080",
        spec.media.characterId,
        false,
      ]);
    // The board's picture 13 is the secret image, never the scene background.
    if (spec.kind === "picture_reveal" && index === 1)
      replacements.push(["13", spec.content.imageId, false]);
    else if (!football || index === 0)
      replacements.push([
        shapeId(biggestPicture(xml) || "") || "",
        spec.media.backgroundId,
        true,
      ]);
    if (football && index >= questionStart && spec.media.backgroundId) {
      const data = assets.get(spec.media.backgroundId);
      if (!data) throw Error("Thiếu ảnh nền.");
      const { cropBackground } = await import("./pptx");
      const name = `scene-${number}.png`;
      zip.file(
        `ppt/media/${name}`,
        await cropBackground(data, spec.media, { width: 1200, height: 900 }),
      );
      rels = rels.replace(
        "</Relationships>",
        `<Relationship Id="rIdGameBackground" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${name}"/></Relationships>`,
      );
      const bg = `<p:bg><p:bgPr><a:blipFill><a:blip r:embed="rIdGameBackground"><a:alphaModFix amt="${Math.round(spec.media.opacity * 100000)}"/></a:blip><a:stretch><a:fillRect/></a:stretch></a:blipFill><a:effectLst/></p:bgPr></p:bg>`;
      xml = xml
        .replace(/<p:bg\b[\s\S]*?<\/p:bg>/, "")
        .replace(/<p:cSld\b[^>]*>/, (m) => m + bg);
    }
    for (const [shapeID, assetID, scene] of replacements) {
      if (!shapeID || !assetID) continue;
      const data = assets.get(assetID);
      if (!data) throw Error("Thiếu ảnh đã chọn.");
      const shape = shapes(xml).find((s) => shapeId(s) === shapeID);
      if (!shape) continue;
      const rid = shape.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1];
      if (!rid) continue;
      const customRid = `rIdCustom${shapeID}`,
        filename = `custom-${number}-${shapeID}.png`;
      let prepared: Buffer;
      if (scene) {
        const { cropBackground } = await import("./pptx");
        const cx = Number(shape.match(/<a:ext\b[^>]*cx="(\d+)"/)?.[1] || 1280),
          cy = Number(shape.match(/<a:ext\b[^>]*cy="(\d+)"/)?.[1] || 720);
        prepared = await cropBackground(data, spec.media, {
          width: 1200,
          height: Math.max(1, Math.round((1200 * cy) / cx)),
        });
      } else {
        const cx = Number(shape.match(/<a:ext\b[^>]*cx="(\d+)"/)?.[1] || 1),
          cy = Number(shape.match(/<a:ext\b[^>]*cy="(\d+)"/)?.[1] || 1);
        prepared = await sharp(data)
          .resize(1000, Math.max(1, Math.round((1000 * cy) / cx)), {
            fit:
              spec.kind === "picture_reveal" && index === 1
                ? "cover"
                : "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer();
      }
      zip.file(`ppt/media/${filename}`, prepared);
      rels = rels.replace(
        "</Relationships>",
        `<Relationship Id="${customRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${filename}"/></Relationships>`,
      );
      let changed = shape
        .replace(`r:embed="${rid}"`, `r:embed="${customRid}"`)
        .replace(/<a:srcRect\b[^>]*\/>/, "");
      if (scene)
        changed = changed.replace(
          /<a:blip\b([^>]*?)(?:\/>|>[\s\S]*?<\/a:blip>)/,
          (_, attrs: string) =>
            `<a:blip${attrs}><a:alphaModFix amt="${Math.round(spec.media.opacity * 100000)}"/></a:blip>`,
        );
      xml = xml.replace(shape, changed);
    }
    if (index === 0) {
      for (const shape of shapes(xml))
        if (textOf(shape) && spec.kind !== "football")
          xml = replaceText(
            xml,
            shapeId(shape)!,
            spec.metadata.title,
            spec.appearance?.font || "Roboto",
          );
    }
    if (football && index === 0 && spec.media.backgroundId) {
      xml = xml.replace(
        "</p:spTree>",
        `<p:sp><p:nvSpPr><p:cNvPr id="9002" name="Game title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="500000" y="500000"/><a:ext cx="8144000" cy="1400000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="3200"><a:latin typeface="Roboto"/></a:rPr><a:t>${escape(spec.metadata.title)}</a:t></a:r></a:p></p:txBody></p:sp>` +
          "</p:spTree>",
      );
    }
    if (index === 1 && !football && spec.kind === "clever_frog") {
      const labels = shapes(xml).filter((s) => textOf(s));
      labels.forEach((s, i) => {
        xml = replaceText(
          xml,
          shapeId(s)!,
          qs[i]?.label || `Ếch ${i + 1}`,
          spec.appearance?.font || "Roboto",
        );
      });
    }
    if (index >= questionStart) {
      const entries = shapes(xml).filter((s) => textOf(s));
      const promptId = football
        ? "15"
        : forest
          ? shapeId(entries[0])!
          : boat
            ? shapeId(entries.find((s) => !/^[ABC]\s*\./.test(textOf(s)))!)!
            : spec.kind === "clever_frog"
              ? "13"
              : "6";
      xml = styleShape(xml, promptId, spec, "question");
      const answerIds = football
        ? ["8", "9", "10", "11"]
        : forest
          ? [shapeId(entries[1])!]
          : boat
            ? entries
                .filter((s) => /^[ABC]\s*\./.test(textOf(s)))
                .map((s) => shapeId(s)!)
            : [spec.kind === "clever_frog" ? "14" : "5"];
      for (const id of answerIds) xml = styleShape(xml, id, spec, "answer");
      const q = qs[index - questionStart];
      if (q.imageId) {
        const data = assets.get(q.imageId);
        if (!data) throw Error("Thiếu ảnh câu hỏi.");
        const prompt = shapes(xml).find((s) => shapeId(s) === promptId)!;
        const x = Number(prompt.match(/<a:off\b[^>]*x="(-?\d+)"/)?.[1] || 0),
          y = Number(prompt.match(/<a:off\b[^>]*y="(-?\d+)"/)?.[1] || 0),
          w = Number(prompt.match(/<a:ext\b[^>]*cx="(\d+)"/)?.[1] || 4000000),
          h = Math.max(
            football ? 1000000 : 0,
            Number(prompt.match(/<a:ext\b[^>]*cy="(\d+)"/)?.[1] || 1000000),
          );
        const iw = Math.round(w * 0.28),
          tw = Math.round(w * 0.68),
          filename = `question-${number}.png`;
        zip.file(
          `ppt/media/${filename}`,
          await sharp(data)
            .resize(900, Math.max(1, Math.round((900 * h) / iw)), {
              fit: "contain",
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .png()
            .toBuffer(),
        );
        xml = xml.replace(
          prompt,
          prompt.replace(
            /<a:ext\b[^>]*cx="\d+"[^>]*cy="\d+"\s*\/>/,
            `<a:ext cx="${tw}" cy="${h}"/>`,
          ),
        );
        const pic = `<p:pic><p:nvPicPr><p:cNvPr id="9001" name="Question illustration"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rIdQuestionImage"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x + w - iw}" y="${football ? 650000 : y}"/><a:ext cx="${iw}" cy="${football ? 900000 : h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
        xml = xml.replace("</p:spTree>", pic + "</p:spTree>");
        rels = rels.replace(
          "</Relationships>",
          `<Relationship Id="rIdQuestionImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${filename}"/></Relationships>`,
        );
      }
    } else
      for (const shape of shapes(xml).filter((s) => textOf(s)))
        xml = styleShape(xml, shapeId(shape)!, spec, "heading");
    rels = rels.replace(
      /(<Relationship\b[^>]*Type="[^"]*\/slide"[^>]*Target=")slide(\d+)\.xml("[^>]*\/?>)/g,
      (full, prefix: string, target: string, suffix: string) => {
        if (full.includes('Id="rIdNextQuestion"')) return full;
        const n = Number(target);
        const destination = questionTargets.get(n) || retained.get(n);
        return destination ? `${prefix}slide${destination}.xml${suffix}` : full;
      },
    );
    // Do not let the template lead into unrelated lesson/advertising slides.
    const invalidRels = [
      ...rels.matchAll(
        /<Relationship\b[^>]*Id="([^"]+)"[^>]*Type="[^"]*\/slide"[^>]*Target="slide(\d+)\.xml"[^>]*\/>/g,
      ),
    ]
      .filter((m) => Number(m[2]) > sequence.length)
      .map((m) => m[1]);
    for (const id of invalidRels) {
      xml = xml.replace(
        new RegExp(`<a:hlinkClick\\b[^>]*r:id="${id}"[^>]*/>`, "g"),
        "",
      );
      rels = rels.replace(
        new RegExp(`<Relationship\\b[^>]*Id="${id}"[^>]*/>`, "g"),
        "",
      );
    }
    if (spec.settings.reducedMotion)
      xml = xml
        .replace(
          /<p:(animEffect|animMotion|animRot|animScale)\b[^>]*>[\s\S]*?<\/p:\1>/g,
          "",
        )
        .replace(/dur="\d+"/g, 'dur="1"');
    if (spec.settings.muted)
      xml = xml
        .replace(/<p:audio>[\s\S]*?<\/p:audio>/g, "")
        .replace(/<a:snd\b[^>]*\/>/g, "");
    zip.file(`ppt/slides/slide${number}.xml`, xml);
    zip.file(getRelPath(number), rels);
    relationships = relationships.replace(
      "</Relationships>",
      `<Relationship Id="rIdGameSlide${number}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${number}.xml"/></Relationships>`,
    );
    content = content.replace(
      "</Types>",
      `<Override PartName="/ppt/slides/slide${number}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`,
    );
  }
  for (const path of Object.keys(zip.files)) {
    const m = path.match(
      /^ppt\/slides\/(?:_rels\/)?slide(\d+)\.xml(?:\.rels)?$/,
    );
    if (m && Number(m[1]) > sequence.length) zip.remove(path);
  }
  // Keep source slide dimensions (football is 4:3), masters, audio and GIFs byte-for-byte.
  const ids = sequence
    .map((_, i) => `<p:sldId id="${256 + i}" r:id="rIdGameSlide${i + 1}"/>`)
    .join("");
  presentation = presentation
    .replace(
      /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,
      `<p:sldIdLst>${ids}</p:sldIdLst>`,
    )
    .replace(/<p:custShowLst>[\s\S]*?<\/p:custShowLst>/, "");
  zip.file("ppt/presentation.xml", presentation);
  zip.file("ppt/_rels/presentation.xml.rels", relationships);
  zip.file("[Content_Types].xml", content);
  // Replace only image relationships explicitly selected by the teacher.
  const result = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  if (result.length > 50 * 1024 * 1024)
    throw Error("File PowerPoint vượt 50 MB.");
  return result;
}

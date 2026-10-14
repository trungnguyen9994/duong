import pptxgen from "pptxgenjs";
import { gameSpecSchema, type GameSpec } from "../../domain/game-spec";
import { compileSlideGraph } from "./slide-graph";
import { scenes, stageTheme } from "../../domain/appearance";
import { loadExportArtwork, type ExportArtwork } from "./artwork";

export async function buildPptx(
  input: GameSpec,
  suppliedArtwork?: ExportArtwork,
): Promise<Blob> {
  const spec = gameSpecSchema.parse(input);
  const artwork =
    suppliedArtwork ||
    (typeof window !== "undefined"
      ? await loadExportArtwork(spec)
      : { scenes: {} });
  const graph = compileSlideGraph(spec);
  const positions = new Map(graph.map((node, i) => [node.id, i + 1]));
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Giáo viên";
  pptx.subject = "Trò chơi Toán lớp 3";
  pptx.title = spec.title;
  pptx.theme = { headFontFace: "Arial", bodyFontFace: "Arial" };
  for (const node of graph) {
    const slide = pptx.addSlide();
    const sceneIndex = node.stageIndex ?? (node.kind === "summary" ? 3 : 0);
    const custom = spec.assets.find(
      (a) => a.id === spec.stages[sceneIndex].backgroundAssetId,
    );
    const background =
      custom?.dataUrl || artwork.scenes[stageTheme(spec, sceneIndex)];
    slide.background = {
      color: scenes[stageTheme(spec, sceneIndex)].sky.slice(1),
    };
    if (background)
      slide.addImage({
        data: background,
        x: 0,
        y: 0,
        w: 13.3333,
        h: 7.5,
        sizing: { type: "cover", w: 13.3333, h: 7.5 },
        altText: "Phong cảnh của chặng",
      });
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.55,
      y: 0.8,
      w: 12.25,
      h: 5.95,
      fill: { color: "FFF6DF", transparency: 4 },
      line: { color: "BA8240", width: 2 },
    });
    const text = (
      content: string,
      x: number,
      y: number,
      w: number,
      h: number,
      size = 28,
      color = "183454",
    ) =>
      slide.addText(content, {
        x,
        y,
        w,
        h,
        fontFace: "Arial",
        fontSize: size,
        color,
        margin: 0.12,
        fit: "shrink",
        valign: "middle",
        lang: "vi-VN",
      });
    const button = (
      label: string,
      target: string,
      x: number,
      y: number,
      w = 4.5,
      h = 0.78,
      color = "A26C2C",
    ) => {
      const hyperlink = { slide: positions.get(target)! };
      slide.addShape(pptx.ShapeType.roundRect, {
        x,
        y,
        w,
        h,
        fill: { color },
        line: { color },
        hyperlink,
      });
      slide.addText(label, {
        x: x + 0.08,
        y: y + 0.04,
        w: w - 0.16,
        h: h - 0.08,
        fontFace: "Arial",
        fontSize: 24,
        bold: true,
        color: "FFFFFF",
        align: "center",
        valign: "middle",
        margin: 0.06,
        fit: "shrink",
        hyperlink,
        lang: "vi-VN",
      });
    };
    text("HÀNH TRÌNH TOÁN HỌC • LỚP 3", 0.5, 0.18, 10, 0.45, 16);
    text(
      `${positions.get(node.id)} / ${graph.length}`,
      11.7,
      0.18,
      1.1,
      0.45,
      14,
    );
    const q = spec.questions.find((q) => q.id === node.questionId);
    if (artwork.explorer && ["cover", "stage"].includes(node.kind))
      slide.addImage({
        data: artwork.explorer,
        x: 10.7,
        y: 4.7,
        w: 1.6,
        h: 1.9,
        sizing: { type: "contain", w: 1.6, h: 1.9 },
        altText: "Nhân vật Bé Sao",
      });
    if (node.kind === "cover") {
      text(spec.title, 1, 1.4, 11.3, 1.8, 40);
      text(spec.description, 1, 3.3, 11.3, 1.3, 24);
      button("Bắt đầu hành trình", "instructions", 4.4, 5.6);
    } else if (node.kind === "instructions") {
      text("Luật chơi", 0.8, 1, 11.7, 0.8, 36);
      text(
        "Chia lớp thành 4 đội. Mỗi câu có một đáp án đúng.\nĐúng lần đầu: 10 điểm. Đúng sau gợi ý: 5 điểm.\nGiáo viên ghi điểm và quản lý thời gian thủ công.\nBấm đáp án để xem phản hồi; chọn Thử lại hoặc Tiếp tục.\nPowerPoint không tự khóa chặng hoặc lưu lượt chơi.",
        1,
        2,
        11.3,
        3,
        26,
      );
      button("Đến bản đồ", "map", 4.4, 5.7);
      slide.addNotes(
        "Tài nguyên được nhúng trong file. Điều khiển bằng nút trên slide. Hạn chế dùng phím mũi tên để tránh bỏ qua phản hồi. Giáo viên cần rà soát nội dung trước khi dạy.",
      );
    } else if (node.kind === "map") {
      text("Bản đồ vương quốc", 0.8, 1, 11.7, 0.8, 36);
      node.links.forEach((link, i) =>
        button(
          `${i + 1}. ${link.label}`,
          link.target,
          1.2 + (i % 2) * 5.6,
          2.4 + Math.floor(i / 2) * 1.5,
          5,
          1.05,
        ),
      );
    } else if (node.kind === "stage") {
      text(`CHẶNG ${node.stageIndex! + 1}`, 1, 1.5, 11.3, 0.7, 24);
      text(spec.stages[node.stageIndex!].title, 1, 2.4, 11.3, 1.4, 42);
      text(
        spec.stages[node.stageIndex!].introText ||
          `${spec.stages[node.stageIndex!].questionIds.length} thử thách đang chờ đội của em`,
        1,
        4,
        11.3,
        0.9,
        26,
      );
      button(node.links[0].label, node.links[0].target, 4.4, 5.6);
    } else if (node.kind === "question" && q) {
      text(spec.stages[node.stageIndex!].title, 0.8, 0.85, 11.7, 0.55, 20);
      const asset = spec.assets.find((a) => a.id === q.imageAssetId);
      text(q.prompt, 0.8, 1.55, asset ? 8 : 11.7, 2.25, 32);
      if (asset)
        slide.addImage({
          data: asset.dataUrl,
          x: 9.2,
          y: 1.5,
          w: 3.1,
          h: 2.4,
          sizing: { type: "contain", w: 3.1, h: 2.4 },
          altText: "Hình minh họa câu hỏi",
        });
      node.links.forEach((link, i) =>
        button(
          `${["A", "B", "C", "D"][i]}. ${link.label}`,
          link.target,
          0.8 + (i % 2) * 6.05,
          4.2 + Math.floor(i / 2) * 1.15,
          5.7,
          0.95,
        ),
      );
    } else if ((node.kind === "correct" || node.kind === "wrong") && q) {
      const correct = node.kind === "correct";
      text(
        correct ? "✓ Chính xác!" : "↻ Chưa đúng, hãy thử lại!",
        0.8,
        1.2,
        11.7,
        1,
        40,
        correct ? "18754A" : "9A5700",
      );
      text(
        correct
          ? q.explanation ||
              `Đáp án: ${q.choices.find((c) => c.id === q.correctChoiceId)!.text}`
          : `Gợi ý: ${q.hint}`,
        1,
        2.6,
        11.3,
        2.1,
        30,
      );
      button(
        node.links[0].label,
        node.links[0].target,
        4.4,
        5.6,
        4.5,
        0.78,
        correct ? "18754A" : "9A5700",
      );
    } else {
      text("Vương quốc đã được giải cứu!", 1, 1.6, 11.3, 1.4, 40);
      text(
        "Chúc mừng cả lớp!\nGiáo viên công bố điểm và cùng ôn lại cách tìm thừa số chưa biết.",
        1,
        3.2,
        11.3,
        1.6,
        28,
      );
      node.links.forEach((link, i) =>
        button(link.label, link.target, 1.7 + i * 5.2, 5.6),
      );
    }
    if (!["cover", "map", "summary"].includes(node.kind))
      button("Bản đồ", "map", 10.9, 6.8, 1.8, 0.45);
  }
  const result = await pptx.write({ outputType: "blob" });
  if (!(result instanceof Blob))
    throw new Error("Không tạo được tệp PowerPoint");
  return result;
}

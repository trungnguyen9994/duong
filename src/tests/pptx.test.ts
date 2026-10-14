import { expect, it } from "vitest";
import JSZip from "jszip";
import { buildPptx } from "../features/export-pptx/export-service";
import { compileSlideGraph } from "../features/export-pptx/slide-graph";
import { sampleGame } from "../domain/sample";

it("writes editable text, all internal edges and an embedded image to a 16:9 PPTX", async () => {
  const spec = sampleGame();
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=";
  spec.assets = [{ id: "test-image", mime: "image/png", dataUrl: png }];
  spec.questions[0].imageAssetId = "test-image";
  const blob = await buildPptx(spec);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const graph = compileSlideGraph(spec);
  const slideFiles = Object.keys(zip.files).filter((p) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(p),
  );
  expect(slideFiles).toHaveLength(44);
  const pres = await zip.file("ppt/presentation.xml")!.async("string");
  expect(pres).toContain('cx="12192000"');
  expect(pres).toContain('cy="6858000"');
  for (let i = 0; i < graph.length; i++) {
    const xml = await zip.file(`ppt/slides/slide${i + 1}.xml`)!.async("string");
    expect(xml).toContain("<a:t>");
    const relationships = await zip
      .file(`ppt/slides/_rels/slide${i + 1}.xml.rels`)!
      .async("string");
    expect(relationships).not.toContain('TargetMode="External"');
    for (const link of graph[i].links) {
      const destination = graph.findIndex((n) => n.id === link.target) + 1;
      expect(relationships).toContain(`Target="slide${destination}.xml"`);
    }
  }
  expect(
    Object.keys(zip.files).some(
      (p) => p.startsWith("ppt/media/") && !zip.files[p].dir,
    ),
  ).toBe(true);
  expect(Object.keys(zip.files).some((p) => p.endsWith("vbaProject.bin"))).toBe(
    false,
  );
}, 20_000);

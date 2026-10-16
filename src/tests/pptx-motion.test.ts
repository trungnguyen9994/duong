import { it, expect } from "vitest";
import JSZip from "jszip";
import { addPowerPointMotion } from "../../server/pptx-motion";
it("adds native transitions and valid object targets without animating hyperlink buttons", async () => {
  const z = new JSZip();
  const shape = (id: number, text: string, link = false) =>
    `<p:sp><p:cNvPr id="${id}"/>${link ? '<a:hlinkClick r:id="rId1"/>' : ""}<a:t>${text}</a:t></p:sp>`;
  z.file(
    "ppt/slides/slide1.xml",
    `<p:sld><p:cSld>${shape(2, "Title")}${shape(3, "Question")}${shape(4, "Answer", true)}<p:pic><p:cNvPr id="5"/></p:pic></p:cSld><p:clrMapOvr/></p:sld>`,
  );
  z.file("ppt/slides/_rels/slide1.xml.rels", "unchanged");
  const input = await z.generateAsync({ type: "nodebuffer" });
  const output = await JSZip.loadAsync(await addPowerPointMotion(input, false));
  const xml = await output.file("ppt/slides/slide1.xml")!.async("string");
  expect(xml).toContain('<p:transition spd="fast" advClick="1"><p:fade/>');
  for (const id of [2, 3, 5]) expect(xml).toContain(`spid="${id}"`);
  expect(xml).not.toContain('spid="4"');
  const ids = [...xml.matchAll(/<p:cTn id="(\d+)"/g)].map((m) => m[1]);
  expect(new Set(ids).size).toBe(ids.length);
  expect(xml.indexOf("<p:transition")).toBeGreaterThan(
    xml.indexOf("<p:clrMapOvr"),
  );
  expect(
    await output.file("ppt/slides/_rels/slide1.xml.rels")!.async("string"),
  ).toBe("unchanged");
  expect(await addPowerPointMotion(input, true)).toBe(input);
});

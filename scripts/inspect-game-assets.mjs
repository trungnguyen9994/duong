import JSZip from "jszip";
import sharp from "sharp";
import { readFile, mkdir, writeFile, readdir } from "node:fs/promises";
const references = [
  ["boat_rescue", "GAME ĐƯA THUYỀN VÀO BỜ TRÁNH BÃO.pptx"],
  ["football", "game-da-bong-giong-IOE.pptx"],
];
await mkdir("data/previews", { recursive: true });
for (const [kind, name] of references) {
  const zip = await JSZip.loadAsync(
    await readFile(`C:/Users/K_170924/Downloads/${name}`),
  );
  await mkdir(`public/art/${kind}`, { recursive: true });
  for (const part of Object.keys(zip.files).filter((p) =>
    /^ppt\/media\/.*\.(png|jpe?g|gif)$/i.test(p),
  )) {
    await writeFile(
      `public/art/${kind}/${part.split("/").at(-1)}`,
      await zip.file(part).async("nodebuffer"),
    );
  }
  for (const num of [2, 3, 4]) {
    const part = zip.file(`ppt/slides/slide${num}.xml`);
    if (!part) continue;
    const xml = await part.async("string");
    console.log(
      kind,
      `SLIDE ${num}`,
      [...xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)].map((m) => ({
        id: m[0].match(/<p:cNvPr[^>]*id="(\d+)"/)?.[1],
        image: m[0].match(/<a:blip[^>]*r:embed="([^"]+)"/)?.[1],
      })),
    );
    console.log(
      (await zip.file(`ppt/slides/_rels/slide${num}.xml.rels`).async("string"))
        .match(/<Relationship\b[^>]*\/>/g)
        ?.filter((x) => /image|slide"/.test(x)),
    );
  }
}
for (const kind of ["forest-rescue", "boat_rescue", "football"]) {
  const files = (await readdir(`public/art/${kind}`))
    .filter((f) => /\.(png|jpe?g|gif)$/.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const composites = [];
  const valid = [];
  for (const file of files) {
    try {
      const buf = await sharp(`public/art/${kind}/${file}`)
        .resize(180, 115, { fit: "contain", background: "#eee" })
        .png()
        .toBuffer();
      const i = valid.length;
      valid.push(file);
      composites.push({
        input: buf,
        left: (i % 5) * 180,
        top: Math.floor(i / 5) * 115,
      });
    } catch {}
  }
  await sharp({
    create: {
      width: 900,
      height: Math.ceil(valid.length / 5) * 115,
      channels: 3,
      background: "#eee",
    },
  })
    .composite(composites)
    .png()
    .toFile(`data/previews/${kind}-assets.png`);
  console.log(kind, "CONTACT SHEET ORDER", valid);
}

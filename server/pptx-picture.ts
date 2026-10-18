import JSZip from "jszip";

/** Native triggers and returning custom shows keep the board alive in Slide Show. */
export async function addPictureInteraction(
  input: Buffer,
  size: number,
  reduced: boolean,
) {
  const zip = await JSZip.loadAsync(input);
  // Small original chime embedded in the package, available offline.
  const samples = 11025,
    rate = 22050;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const t = i / rate,
      frequency = t < 0.18 ? 660 : 880;
    const envelope = Math.min(1, t * 50) * Math.max(0, 1 - t * 2);
    wav.writeInt16LE(
      Math.round(Math.sin(2 * Math.PI * frequency * t) * envelope * 6000),
      44 + i * 2,
    );
  }
  if (!reduced) {
    zip.file("ppt/media/puzzle-chime.wav", wav);
    let types = await zip.file("[Content_Types].xml")!.async("string");
    if (!/Extension="wav"/.test(types))
      types = types.replace(
        "</Types>",
        '<Default Extension="wav" ContentType="audio/wav"/></Types>',
      );
    zip.file("[Content_Types].xml", types);
  }
  let presentation = await zip.file("ppt/presentation.xml")!.async("string");
  const slideIds = [
    ...presentation.matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"[^>]*\/?\s*>/g),
  ].map((m) => m[1]);
  const shows = Array.from(
    { length: size },
    (_, i) =>
      `<p:custShow name="Mảnh ghép ${i + 1}" id="${i}"><p:sldLst><p:sld r:id="${slideIds[i + 2]}"/></p:sldLst></p:custShow>`,
  ).join("");
  const showList = `<p:custShowLst>${shows}</p:custShowLst>`;
  const successor =
    /<p:(?:photoAlbum|custDataLst|kinsoku|defaultTextStyle|modifyVerifier|extLst)\b/.exec(
      presentation,
    );
  presentation = successor
    ? presentation.slice(0, successor.index) +
      showList +
      presentation.slice(successor.index)
    : presentation.replace("</p:presentation>", showList + "</p:presentation>");
  zip.file("ppt/presentation.xml", presentation);

  for (let index = 2; index <= size + 2; index++) {
    const path = `ppt/slides/slide${index}.xml`;
    let xml = await zip.file(path)!.async("string");
    if (!reduced) {
      const relPath = `ppt/slides/_rels/slide${index}.xml.rels`;
      const rels = await zip.file(relPath)!.async("string");
      zip.file(
        relPath,
        rels.replace(
          "</Relationships>",
          '<Relationship Id="rIdPuzzleChime" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/audio" Target="../media/puzzle-chime.wav"/></Relationships>',
        ),
      );
    }
    let nextId = 2;
    const target = (id: string) => `<p:tgtEl><p:spTgt spid="${id}"/></p:tgtEl>`;
    const visibility = (id: string, visible: boolean, delay = 0) =>
      `<p:set><p:cBhvr><p:cTn id="${nextId++}" dur="1" fill="hold"><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst></p:cTn>${target(id)}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="${visible ? "visible" : "hidden"}"/></p:to></p:set>`;
    const fade = (id: string, visible: boolean) =>
      reduced
        ? ""
        : `<p:animEffect transition="${visible ? "in" : "out"}" filter="fade"><p:cBhvr><p:cTn id="${nextId++}" dur="400"/>${target(id)}</p:cBhvr></p:animEffect>`;
    const trigger = (
      button: string,
      shape: string,
      visible: boolean,
      companion?: string,
    ) => {
      const seq = nextId++,
        effect = nextId++;
      let body = visible
        ? visibility(shape, true) + fade(shape, true)
        : fade(shape, false) + visibility(shape, false, reduced ? 0 : 399);
      if (companion)
        body +=
          fade(companion, false) +
          visibility(companion, false, reduced ? 0 : 399);
      const sound = reduced
        ? ""
        : `<p:subTnLst><p:audio><p:cMediaNode><p:cTn id="${nextId++}" dur="500" display="0" masterRel="sameClick"><p:stCondLst><p:cond evt="begin" delay="0"><p:tn val="${effect}"/></p:cond></p:stCondLst></p:cTn><p:tgtEl><p:sndTgt r:embed="rIdPuzzleChime" name="Mở mảnh ghép"/></p:tgtEl></p:cMediaNode></p:audio></p:subTnLst>`;
      return `<p:seq concurrent="1" nextAc="none"><p:cTn id="${seq}" restart="never" fill="hold" evtFilter="cancelBubble" nodeType="interactiveSeq"><p:stCondLst><p:cond evt="onClick" delay="0">${target(button)}</p:cond></p:stCondLst><p:childTnLst><p:par><p:cTn id="${effect}" presetID="10" presetClass="${visible ? "entr" : "exit"}" presetSubtype="0" fill="hold" nodeType="clickEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${body}</p:childTnLst>${sound}</p:cTn></p:par></p:childTnLst></p:cTn></p:seq>`;
    };
    const shapes = [...xml.matchAll(/<p:(sp|pic)>[\s\S]*?<\/p:\1>/g)];
    const shapeId = (name: string) =>
      shapes
        .find((m) => m[0].includes(`name="${name}"`))?.[0]
        .match(/<p:cNvPr\b[^>]*id="(\d+)"/)?.[1];
    let effects = "";
    if (index === 2) {
      for (let i = 0; i < size; i++) {
        const tile = shapeId(`puzzle-tile-${i}`);
        if (!tile) throw Error("Thiếu đối tượng mảnh ghép trong PowerPoint.");
        // Match the supplied teacher-led template: selecting a tile also
        // schedules its exit animation before the returning question show.
        const original = shapes.find((m) =>
          m[0].includes(`name="puzzle-tile-${i}"`),
        )![0];
        const linked = original.replace(
          /<a:hlinkClick\b[^>]*\/>/,
          `<a:hlinkClick r:id="" action="ppaction://customshow?id=${i}&amp;return=true"/>`,
        );
        xml = xml.replace(original, linked);
        const label = shapeId(`frog-label-${i}`);
        effects += trigger(tile, tile, false, label);
        if (label) {
          const originalLabel = shapes.find((m) =>
            m[0].includes(`name="frog-label-${i}"`),
          )![0];
          xml = xml.replace(
            originalLabel,
            originalLabel.replace(
              /<a:hlinkClick\b[^>]*\/>/,
              `<a:hlinkClick r:id="" action="ppaction://customshow?id=${i}&amp;return=true"/>`,
            ),
          );
          effects += trigger(label, label, false, tile);
        }
      }
    } else {
      const button = shapeId("puzzle-answer-button"),
        answer = shapeId("puzzle-answer");
      if (!button || !answer) throw Error("Thiếu nút hiện đáp án.");
      effects += trigger(button, answer, true);
      const back = shapes.find((m) =>
        m[0].includes('name="puzzle-return"'),
      )![0];
      xml = xml.replace(
        back,
        back.replace(
          /<a:hlinkClick\b[^>]*\/>/,
          '<a:hlinkClick r:id="" action="ppaction://hlinkshowjump?jump=endshow"/>',
        ),
      );
    }
    const character = [...xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)]
      .find((m) => m[0].includes('name="game-character"'))?.[0]
      .match(/<p:cNvPr\b[^>]*id="(\d+)"/)?.[1];
    const moving = [...(character ? [character] : []), ...(index === 2 && shapeId("frog-label-0") ? Array.from({length:size}, (_, i) => shapeId(`puzzle-tile-${i}`)!).filter(Boolean) : [])];
    for (const movingId of reduced ? [] : moving) {
      const effect = nextId++;
      const rotations = [120000, -240000, 120000]
        .map(
          (by, i) =>
            `<p:animRot by="${by}"><p:cBhvr><p:cTn id="${nextId++}" dur="300" fill="hold"><p:stCondLst><p:cond delay="${i * 300}"/></p:stCondLst></p:cTn>${target(movingId)}<p:attrNameLst><p:attrName>r</p:attrName></p:attrNameLst></p:cBhvr></p:animRot>`,
        )
        .join("");
      effects += `<p:par><p:cTn id="${effect}" dur="900" repeatCount="indefinite" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${rotations}</p:childTnLst></p:cTn></p:par>`;
    }
    xml = xml
      .replace(/<p:timing>[\s\S]*?<\/p:timing>/, "")
      .replace(/<p:transition\b[\s\S]*?<\/p:transition>/, "");
    const timing = `<p:transition advClick="0"${reduced ? "" : ' spd="fast"'}>${reduced ? "" : "<p:fade/>"}</p:transition><p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>${effects}</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;
    xml = xml.replace("</p:sld>", timing + "</p:sld>");
    zip.file(path, xml);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

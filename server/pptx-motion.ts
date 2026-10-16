import JSZip from "jszip";
/** Add native PresentationML motion after PptxGenJS writes editable shapes. */
export async function addPowerPointMotion(
  input: Buffer,
  reducedMotion: boolean,
): Promise<Buffer> {
  if (reducedMotion) return input;
  const zip = await JSZip.loadAsync(input);
  for (const path of Object.keys(zip.files).filter((p) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(p),
  )) {
    let xml = await zip.file(path)!.async("string");
    // Keep hyperlink buttons immediately visible and clickable. Animate only text
    // content and the final picture (the character), never background pictures.
    const textShapes = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)]
      .filter(
        (m) =>
          !m[0].includes("<a:hlinkClick") &&
          m[0].includes("<a:t>") &&
          !/____|Thời gian:|Không giới hạn giờ|EduGame Studio/.test(m[0]),
      )
      .map((m) => m[0].match(/<p:cNvPr[^>]*\bid="(\d+)"/)?.[1])
      .filter((id): id is string => !!id);
    const pictures = [...xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)];
    const character = pictures
      .at(-1)?.[0]
      .match(/<p:cNvPr[^>]*\bid="(\d+)"/)?.[1];
    const targets = [
      ...textShapes.slice(0, 2),
      ...(character ? [character] : []),
    ];
    let id = 2;
    const effects = targets
      .map((shape, index) => {
        const outer = id++,
          visible = id++,
          fade = id++;
        return `<p:par><p:cTn id="${outer}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" nodeType="withEffect"><p:stCondLst><p:cond delay="${index * 120}"/></p:stCondLst><p:childTnLst><p:set><p:cBhvr><p:cTn id="${visible}" dur="1" fill="hold"/><p:tgtEl><p:spTgt spid="${shape}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set><p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${fade}" dur="350"/><p:tgtEl><p:spTgt spid="${shape}"/></p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par>`;
      })
      .join("");
    const motion = `<p:transition spd="fast" advClick="1"><p:fade/></p:transition><p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>${effects}</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;
    // CT_Slide order: cSld, clrMapOvr, transition, timing, extLst.
    xml = xml.includes("<p:extLst")
      ? xml.replace("<p:extLst", motion + "<p:extLst")
      : xml.replace("</p:sld>", motion + "</p:sld>");
    zip.file(path, xml);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

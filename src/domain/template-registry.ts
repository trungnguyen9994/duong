import {
  studioSpecSchema,
  templateRegistry,
  type TemplateType,
} from "./studio-spec";
const entries = studioSpecSchema.options;
export function getTemplate(type: TemplateType, version: number) {
  if (version !== 1 || !Object.hasOwn(templateRegistry, type))
    throw new Error(`Không hỗ trợ template ${type}@${version}.`);
  const index = type === "journey" ? 0 : type === "picture_reveal" ? 1 : 2;
  return Object.freeze({
    ...templateRegistry[type],
    key: `${type}@${version}`,
    validator: entries[index],
    editorSchema: Object.freeze({
      steps: [
        "metadata",
        "template",
        "content",
        "media",
        "settings",
        "preview",
      ],
      fields: Object.keys(entries[index].shape.content.shape),
    }),
    webRenderer: `${type}@${version}`,
    pptxAdapter: `${type}@${version}`,
    capabilities: Object.freeze({
      web: true,
      pptx: true,
      manualTimer: true,
      manualScoring: true,
      linearReveal: type !== "journey",
      randomWheel: false,
    }),
  });
}

import type { TemplateType } from "./studio-spec";

/** Animated game objects are not interchangeable with a companion portrait. */
export function characterLabel(kind: TemplateType): string | null {
  if (kind === "forest_rescue" || kind === "boat_rescue") return null;
  return kind === "football" ? "Thủ môn" : "Nhân vật đồng hành";
}

import type { CSSProperties } from "react";
import type { StudioSpec } from "../domain/studio-spec";
import "./game-theme.css";
export const defaultGameTheme = {
  font: "Roboto" as const,
  text: "#143c70",
  question: "#fff4de",
  answer: "#ffd88a",
  heading: "#a96930",
};
export function gameThemeStyle(spec: StudioSpec): CSSProperties {
  if (!spec.appearance) return {};
  const t = spec.appearance;
  return {
    "--game-font": `"${t.font}", sans-serif`,
    "--game-text": t.text,
    "--game-question": t.question,
    "--game-answer": t.answer,
    "--game-heading": t.heading,
  } as CSSProperties;
}

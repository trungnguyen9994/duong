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
export function lowContrastTheme(spec: StudioSpec): boolean {
  if (!spec.appearance) return false;
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const foreground = luminance(spec.appearance.text);
  return [
    spec.appearance.question,
    spec.appearance.answer,
    spec.appearance.heading,
  ].some((color) => {
    const background = luminance(color);
    return (
      (Math.max(foreground, background) + 0.05) /
        (Math.min(foreground, background) + 0.05) <
      4.5
    );
  });
}
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

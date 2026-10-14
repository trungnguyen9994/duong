import type { GameSpec } from "./game-spec";

export const sceneThemes = ["forest", "mountain", "cave", "castle"] as const;
export type SceneTheme = (typeof sceneThemes)[number];
export const scenes: Record<
  SceneTheme,
  { name: string; icon: string; sky: string; ground: string; image: string }
> = {
  forest: {
    name: "Rừng xanh kỳ diệu",
    icon: "🌳",
    sky: "#bceaff",
    ground: "#76bd63",
    image: "/art/forest.png",
  },
  mountain: {
    name: "Thác nước phiêu lưu",
    icon: "🏞️",
    sky: "#c5ecff",
    ground: "#80ba86",
    image: "/art/mountain.png",
  },
  cave: {
    name: "Hang pha lê bí mật",
    icon: "💎",
    sky: "#a9acd7",
    ground: "#7b6baa",
    image: "/art/cave.png",
  },
  castle: {
    name: "Lâu đài cầu vồng",
    icon: "🏰",
    sky: "#c5eafd",
    ground: "#99c875",
    image: "/art/castle.png",
  },
};
export function stageTheme(spec: GameSpec, index: number): SceneTheme {
  return spec.stages[index]?.backgroundTheme || sceneThemes[index % 4];
}
export function sceneSvg(theme: SceneTheme) {
  const { sky, ground } = scenes[theme];
  const tree = (x: number, y: number, scale = 1) =>
    `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M0 20 L-8 155 L10 155 L6 20" fill="#95623d"/><circle cx="0" cy="0" r="60" fill="#307d55"/><circle cx="-35" cy="20" r="40" fill="#44965b"/><circle cx="30" cy="-20" r="40" fill="#65b363"/></g>`;
  const decorations =
    theme === "cave"
      ? '<path d="M0 0H1280V130L1120 70 1030 220 980 65 760 110 630 55 420 100 180 230 80 100 0 140Z" fill="#5a517f"/><path d="M40 640L80 390 125 465 145 640M1140 670L1190 420 1240 510 1270 670" fill="#76e0ee" stroke="#dafaff" stroke-width="4"/>'
      : `${tree(20, 175, 2)}${tree(1250, 170, 1.7)}<g fill="white" opacity=".8"><ellipse cx="330" cy="95" rx="90" ry="28"/><ellipse cx="960" cy="90" rx="75" ry="25"/></g>`;
  const castle =
    theme === "castle"
      ? '<g transform="translate(965 240)" stroke="#a399c7" stroke-width="5"><rect x="0" y="0" width="150" height="190" fill="#fff0d4"/><rect x="-40" y="-30" width="55" height="220" fill="#fff6e3"/><rect x="135" y="-30" width="55" height="220" fill="#fff6e3"/><path d="M-55-30L-12-110 28-30M125-30L162-110 202-30" fill="#a68bdf"/><path d="M55 190V120Q75 85 95 120V190" fill="#d6b886"/></g>'
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="${sky}"/><circle cx="1050" cy="85" r="48" fill="#fff5b6"/><path d="M0 450L160 205 355 470 470 320 680 475 920 270 1280 440V720H0Z" fill="#83b4bc" opacity=".6"/><path d="M0 545Q350 380 680 540T1280 470V720H0Z" fill="${ground}"/><path d="M510 720Q570 560 920 490L945 500Q680 590 810 720" fill="#f3d292"/>${castle}${decorations}</svg>`;
}
export function backgroundStyle(spec: GameSpec, index: number) {
  const theme = stageTheme(spec, index);
  const assetId = spec.stages[index]?.backgroundAssetId;
  const custom = spec.assets.find((a) => a.id === assetId)?.dataUrl;
  return {
    backgroundImage: custom
      ? `url("${custom}")`
      : `url("${scenes[theme].image}"), url("data:image/svg+xml,${encodeURIComponent(sceneSvg(theme))}")`,
    backgroundColor: scenes[theme].sky,
  };
}
export function usedAssetIds(spec: GameSpec) {
  return new Set(
    [
      ...spec.questions.map((q) => q.imageAssetId),
      ...spec.stages.map((s) => s.backgroundAssetId),
    ].filter(Boolean),
  );
}

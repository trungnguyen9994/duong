import type { GameSpec } from "../../domain/game-spec";
import { scenes, stageTheme, type SceneTheme } from "../../domain/appearance";

export type ExportArtwork = {
  scenes: Partial<Record<SceneTheme, string>>;
  explorer?: string;
};
async function embeddedImage(url: string, transparent = false) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(
      "Không tải được ảnh nền hoặc nhân vật. Hãy tải lại trang rồi thử xuất.",
    );
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Ảnh nền không đọc được"));
      img.src = objectUrl;
    });
    const scale = Math.min(1, (transparent ? 600 : 1280) / image.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Trình duyệt không hỗ trợ chuẩn bị hình ảnh");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(transparent ? "image/png" : "image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
export async function loadExportArtwork(
  spec: GameSpec,
): Promise<ExportArtwork> {
  const themes = [...new Set(spec.stages.map((_, i) => stageTheme(spec, i)))];
  const pairs = await Promise.all(
    themes.map(
      async (theme) =>
        [theme, await embeddedImage(scenes[theme].image)] as const,
    ),
  );
  return {
    scenes: Object.fromEntries(pairs),
    explorer:
      (spec.config.character || "explorer") === "explorer"
        ? await embeddedImage("/art/explorer.png", true)
        : undefined,
  };
}

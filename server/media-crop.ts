import sharp from "sharp";
export type Crop = {
  fit: "cover" | "contain";
  x: number;
  y: number;
  zoom: number;
  opacity: number;
  aspect: "16:9" | "4:5" | "1:1";
};
export async function cropImage(source: Buffer, crop: Crop) {
  const [w, h] =
    crop.aspect === "4:5"
      ? [512, 640]
      : crop.aspect === "1:1"
        ? [720, 720]
        : [1280, 720];
  const rotated = await sharp(source).rotate().toBuffer(),
    meta = await sharp(rotated).metadata();
  const base =
    crop.fit === "cover"
      ? Math.max(w / meta.width!, h / meta.height!)
      : Math.min(w / meta.width!, h / meta.height!);
  const width = Math.max(1, Math.round(meta.width! * base * crop.zoom)),
    height = Math.max(1, Math.round(meta.height! * base * crop.zoom));
  const left = Math.round(((w - width) * crop.x) / 100),
    top = Math.round(((h - height) * crop.y) / 100),
    cx = Math.max(0, -left),
    cy = Math.max(0, -top);
  const scaled = await sharp(rotated)
    .resize(width, height)
    .extract({
      left: cx,
      top: cy,
      width: Math.min(width - cx, w),
      height: Math.min(height - cy, h),
    })
    .toBuffer();
  const result = await sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: scaled, left: Math.max(0, left), top: Math.max(0, top) },
    ])
    .png()
    .toBuffer();
  return sharp(result)
    .composite([
      {
        input: {
          create: {
            width: w,
            height: h,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: crop.opacity },
          },
        },
        blend: "dest-in",
      },
    ])
    .webp({ quality: 88 })
    .toBuffer();
}

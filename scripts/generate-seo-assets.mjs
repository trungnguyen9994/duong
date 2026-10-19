import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const publicDir = new URL("../public/", import.meta.url);
const logo = await readFile(new URL("art/thach-ban-logo.png", publicDir));

for (const size of [16, 32, 180, 192, 512]) {
  const filename =
    size === 180
      ? "apple-touch-icon.png"
      : size === 192
        ? "icon-192.png"
        : size === 512
          ? "icon-512.png"
          : `favicon-${size}x${size}.png`;

  await sharp(logo)
    .resize(size, size, { fit: "contain", background: "#ffffff" })
    .png({ compressionLevel: 9 })
    .toFile(fileURLToPath(new URL(filename, publicDir)));
}

const faviconPng = await readFile(new URL("favicon-32x32.png", publicDir));
const icoHeader = Buffer.alloc(22);
icoHeader.writeUInt16LE(0, 0);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(1, 4);
icoHeader.writeUInt8(32, 6);
icoHeader.writeUInt8(32, 7);
icoHeader.writeUInt16LE(1, 10);
icoHeader.writeUInt16LE(32, 12);
icoHeader.writeUInt32LE(faviconPng.length, 14);
icoHeader.writeUInt32LE(22, 18);
await writeFile(
  new URL("favicon.ico", publicDir),
  Buffer.concat([icoHeader, faviconPng]),
);

const logoData = logo.toString("base64");
const socialCard = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#eff8ff" />
      <stop offset="0.52" stop-color="#fffdf5" />
      <stop offset="1" stop-color="#fff2e8" />
    </linearGradient>
    <linearGradient id="accent" x1="0" x2="1">
      <stop stop-color="#075e9d" />
      <stop offset="1" stop-color="#0ea5e9" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#075e9d" flood-opacity="0.16" />
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#background)" />
  <circle cx="1100" cy="70" r="180" fill="#fdba17" opacity="0.12" />
  <circle cx="1020" cy="610" r="240" fill="#0ea5e9" opacity="0.1" />
  <rect width="1200" height="14" fill="url(#accent)" />
  <rect x="72" y="84" width="418" height="418" rx="48" fill="#ffffff" filter="url(#shadow)" />
  <image href="data:image/png;base64,${logoData}" x="100" y="112" width="362" height="362" preserveAspectRatio="xMidYMid meet" />
  <text x="555" y="194" font-family="Arial, sans-serif" font-size="66" font-weight="800" fill="#075e9d">DƯƠNG LEARNING</text>
  <text x="558" y="256" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#f97316">Trò chơi dạy học tương tác</text>
  <text x="558" y="320" font-family="Arial, sans-serif" font-size="25" fill="#27445d">Tạo bài học sinh động, chơi trực tuyến</text>
  <text x="558" y="358" font-family="Arial, sans-serif" font-size="25" fill="#27445d">và xuất PowerPoint dễ dàng.</text>
  <rect x="555" y="408" width="438" height="62" rx="31" fill="#075e9d" />
  <text x="774" y="448" text-anchor="middle" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="#ffffff">duonglearning.io.vn</text>
  <text x="72" y="570" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#075e9d">Đỗ Thị Thùy Dương · Trường Tiểu học Thạch Bàn (Phân hiệu)</text>
</svg>`;

await sharp(Buffer.from(socialCard))
  .png({ quality: 95, compressionLevel: 9 })
  .toFile(fileURLToPath(new URL("social-share.png", publicDir)));

console.log("Đã tạo favicon và social-share.png.");

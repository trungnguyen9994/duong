import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

if (process.platform !== "win32" || !process.env.APPDATA)
  throw new Error("Tự khởi động này chỉ dành cho Windows.");
const root = fileURLToPath(new URL("../", import.meta.url));
const startup = path.join(
  process.env.APPDATA,
  "Microsoft/Windows/Start Menu/Programs/Startup",
);
const target = path.join(startup, "DuongLearningLocal.vbs");
const marker =
  "' DuongLearning local startup - managed by scripts/install-autostart.mjs";
try {
  const bytes = await readFile(target);
  const previous =
    bytes[0] === 0xff && bytes[1] === 0xfe
      ? bytes.subarray(2).toString("utf16le")
      : bytes.toString("utf8");
  if (!previous.startsWith(marker))
    throw new Error(
      "Tên mục khởi động đã được dùng bởi tệp khác; không ghi đè.",
    );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const escape = (text) => text.replaceAll('"', '""');
const nodePaths = [
  ...new Set([
    process.execPath,
    path.join(
      process.env.ProgramFiles || "C:/Program Files",
      "nodejs/node.exe",
    ),
    path.join(
      process.env.USERPROFILE,
      ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe",
    ),
  ]),
];
const launch = `${marker}\r\nSet fso = CreateObject("Scripting.FileSystemObject")\r\nSet shell = CreateObject("WScript.Shell")\r\nshell.CurrentDirectory = "${escape(root)}"\r\nFor Each nodePath In Array(${nodePaths.map((item) => `"${escape(item)}"`).join(", ")})\r\n  If fso.FileExists(nodePath) Then\r\n    shell.Run Chr(34) & nodePath & Chr(34) & " " & Chr(34) & "${escape(path.join(root, "scripts/dev-local.mjs"))}" & Chr(34) & " --background", 0, False\r\n    WScript.Quit\r\n  End If\r\nNext\r\n`;
await mkdir(startup, { recursive: true });
await writeFile(target, Buffer.from("\uFEFF" + launch, "utf16le"));
console.log(`Đã bật tự chạy khi đăng nhập Windows: ${target}`);
console.log(`Log: ${path.join(root, "data/local-runtime/launcher.log")}`);

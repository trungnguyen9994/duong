import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

const execute = promisify(execFile);
const installedDocker = path.join(
  process.env.ProgramFiles || "C:/Program Files",
  "Docker/Docker/resources/bin/docker.exe",
);
export const dockerExecutable =
  process.platform === "win32" && existsSync(installedDocker)
    ? installedDocker
    : "docker";
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function command(file, args, options = {}) {
  return (
    await execute(file === "docker" ? dockerExecutable : file, args, {
      windowsHide: true,
      timeout: 15000,
      maxBuffer: 1024 * 1024,
      ...options,
    })
  ).stdout;
}

export async function ensureDocker(options = {}) {
  const run = options.run || command;
  const files = options.files || fs;
  const platform = options.platform || process.platform;
  const localAppData = options.localAppData || process.env.LOCALAPPDATA;
  const sleep = options.sleep || delay;
  const log = options.log || console.log;
  const now = options.now || Date.now;
  const deadline = now() + (options.timeoutMs || 180000);
  async function ready() {
    try {
      return !!(
        await run("docker", ["info", "--format", "{{.ServerVersion}}"], {
          timeout: 5000,
        })
      ).trim();
    } catch (error) {
      if (error.code === "ENOENT")
        throw new Error(
          "Chưa cài Docker hoặc không tìm thấy docker trong PATH.",
        );
      return false;
    }
  }
  if (await ready()) return;
  if (platform !== "win32")
    throw new Error(
      "Docker Engine chưa chạy. Khởi động Docker rồi chạy lại dự án.",
    );
  // A remote Docker context must never trigger changes to the local Desktop.
  const endpoint = JSON.parse(
    (
      await run("docker", [
        "context",
        "inspect",
        "--format",
        "{{json .Endpoints.docker.Host}}",
      ])
    ).trim(),
  );
  if (!endpoint.startsWith("npipe:////./pipe/"))
    throw new Error(
      "Docker context không trỏ tới Docker Desktop local; không tự sửa cấu hình này.",
    );
  async function status() {
    try {
      return JSON.parse(
        await run("docker", ["desktop", "status", "--format", "json"]),
      ).Status?.toLowerCase();
    } catch {
      return "unknown";
    }
  }
  async function parkStoppedRuntime() {
    if (!localAppData || (await status()) !== "stopped" || (await ready()))
      return;
    const root = path.resolve(localAppData, "Docker");
    const source = path.join(root, "run");
    let entries;
    try {
      entries = await files.readdir(source);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    if (
      !entries.some(
        (name) => name.endsWith(".sock") || name === "dockerInference",
      )
    )
      return;
    // Stop only an already-stopped Desktop's remnants, never a live engine.
    await run("docker", ["desktop", "stop", "--force", "--timeout", "15"], {
      timeout: 20000,
    });
    if ((await status()) !== "stopped" || (await ready()))
      throw new Error(
        "Docker đổi trạng thái; bỏ qua phục hồi runtime để bảo vệ tiến trình đang chạy.",
      );
    const processes = await run("powershell.exe", [
      "-NoProfile",
      "-Command",
      "@(Get-Process -Name 'Docker Desktop','com.docker.backend' -ErrorAction SilentlyContinue).Count",
    ]);
    if (Number(processes.trim()) !== 0)
      throw new Error(
        "Docker vẫn còn tiến trình; chưa thể phục hồi socket an toàn.",
      );
    const backup = path.join(
      root,
      `run-stale-${new Date(now()).toISOString().replace(/[:.]/g, "-")}-${process.pid}`,
    );
    if (path.dirname(source) !== root || path.dirname(backup) !== root)
      throw new Error("Đường dẫn runtime không hợp lệ.");
    await files.rename(source, backup);
    await files.mkdir(source, { recursive: true });
    log(`Đã lưu runtime socket cũ tại ${backup}`);
  }
  await parkStoppedRuntime();
  log("Đang khởi động Docker Desktop và chờ engine…");
  try {
    await run("docker", ["desktop", "start", "--detach"], { timeout: 20000 });
  } catch {
    /* Startup may continue after the CLI timeout; probe the engine below. */
  }
  let recovered = false;
  while (now() < deadline) {
    if (await ready()) {
      log("Docker Engine đã sẵn sàng.");
      return;
    }
    if (!recovered && (await status()) === "stopped") {
      recovered = true;
      await parkStoppedRuntime();
      await run("docker", ["desktop", "start", "--detach"], { timeout: 20000 });
    }
    await sleep(2000);
  }
  throw new Error(
    "Docker Engine chưa sẵn sàng sau 3 phút. Xem Docker Desktop và data/local-runtime/launcher.log.",
  );
}

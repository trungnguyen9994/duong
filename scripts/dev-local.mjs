import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";
import { openSync, closeSync } from "node:fs";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { uptime } from "node:os";
import dotenv from "dotenv";
import { startLocal } from "./start-local.mjs";
import { command, delay } from "./docker-ready.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
dotenv.config({ path: path.join(root, ".env"), quiet: true });
const runtime = path.join(root, "data", "local-runtime");
await mkdir(runtime, { recursive: true });
if (process.argv.includes("--stop")) {
  const lockPath = path.join(runtime, "dev.lock");
  let previous;
  try {
    previous = JSON.parse(await readFile(lockPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (previous) {
    if (
      previous.root !== root ||
      !Number.isInteger(previous.pid) ||
      previous.pid < 1
    )
      throw new Error("Khóa tiến trình không hợp lệ.");
    let alive = true;
    try {
      process.kill(previous.pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") alive = false;
      else throw error;
    }
    if (alive && process.platform === "win32") {
      const args = await command("powershell.exe", [
        "-NoProfile",
        "-Command",
        `(Get-CimInstance Win32_Process -Filter "ProcessId = ${previous.pid}").CommandLine`,
      ]);
      if (
        !args
          .toLowerCase()
          .includes(fileURLToPath(import.meta.url).toLowerCase())
      )
        throw new Error(
          "Tiến trình không khớp launcher nền của dự án; dùng Ctrl+C tại terminal đang chạy.",
        );
      await command("taskkill.exe", ["/PID", String(previous.pid), "/T", "/F"]);
      await unlink(lockPath).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    } else if (alive) process.kill(previous.pid, "SIGTERM");
    else await unlink(lockPath);
  }
  console.log("Đã dừng web/API/worker của dự án; giữ Docker và database.");
} else if (process.argv.includes("--background")) {
  const log = openSync(path.join(runtime, "launcher.log"), "a");
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
    cwd: root,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", log, log],
    env: process.env,
  });
  child.unref();
  closeSync(log);
} else {
  const lockPath = path.join(runtime, "dev.lock");
  let lock,
    stopping = false,
    recovering = false,
    failures = 0,
    monitor;
  const children = new Set();
  const timers = new Set();
  async function lockInstance() {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        lock = await open(lockPath, "wx");
        await lock.writeFile(
          JSON.stringify({
            pid: process.pid,
            root,
            startedAt: new Date().toISOString(),
          }),
        );
        return true;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        let previous;
        try {
          previous = JSON.parse(await readFile(lockPath, "utf8"));
        } catch {
          throw new Error(
            "Không đọc được khóa khởi chạy; kiểm tra data/local-runtime/dev.lock.",
          );
        }
        if (previous.root !== root)
          throw new Error("Khóa khởi chạy không thuộc dự án này.");
        const previousBoot =
          Date.parse(previous.startedAt) < Date.now() - uptime() * 1000;
        if (!previousBoot) {
          try {
            process.kill(previous.pid, 0);
            console.log(`Dự án đã có tiến trình khởi chạy (${previous.pid}).`);
            return false;
          } catch (error) {
            if (error.code !== "ESRCH") throw error;
          }
        }
        await unlink(lockPath);
      }
    }
    throw new Error("Không lấy được khóa khởi chạy.");
  }
  let base = `http://127.0.0.1:${process.env.API_PORT || 8787}`;
  async function listening(port) {
    return new Promise((resolve) => {
      const socket = createConnection({ host: "127.0.0.1", port });
      const finish = (value) => {
        socket.destroy();
        resolve(value);
      };
      socket.once("connect", () => finish(true));
      socket.once("error", () => finish(false));
      socket.setTimeout(1000, () => finish(false));
    });
  }
  async function health() {
    try {
      const response = await fetch(`${base}/api/health`, {
        signal: AbortSignal.timeout(4000),
      });
      const body = await response.json();
      return response.ok && body.ok && body.database === "mariadb";
    } catch {
      return false;
    }
  }
  async function stop() {
    if (stopping) return;
    stopping = true;
    clearInterval(monitor);
    for (const timer of timers) clearTimeout(timer);
    await Promise.all(
      [...children].map(async (child) => {
        if (process.platform === "win32") {
          try {
            await command("taskkill.exe", [
              "/PID",
              String(child.pid),
              "/T",
              "/F",
            ]);
          } catch {
            /* Already exited. */
          }
        } else child.kill("SIGTERM");
      }),
    );
    await lock?.close();
    if (lock) await unlink(lockPath).catch(() => {});
  }
  function start(name, args, retries = 0) {
    if (stopping) return;
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    children.add(child);
    child.once("error", (error) => {
      console.error(`${name}: ${error.message}`);
    });
    child.once("close", (code) => {
      children.delete(child);
      if (stopping) return;
      const wait = Math.min(30000, 1000 * 2 ** Math.min(retries, 5));
      console.error(
        `${name} đã dừng (${code}); khởi động lại sau ${wait / 1000}s.`,
      );
      const timer = setTimeout(() => {
        timers.delete(timer);
        start(name, args, retries + 1);
      }, wait);
      timers.add(timer);
    });
  }
  process.once("SIGINT", () => {
    void stop();
  });
  process.once("SIGTERM", () => {
    void stop();
  });
  try {
    if (await lockInstance()) {
      console.log(
        `\n[${new Date().toISOString()}] Khởi chạy Dương Learning tại ${root}`,
      );
      for (const port of [5173, Number(process.env.API_PORT || 8787)]) {
        if (await listening(port))
          throw new Error(
            `Cổng ${port} đã có tiến trình khác. Dừng lệnh chạy dự án cũ trước khi dùng launcher mới.`,
          );
      }
      await startLocal();
      dotenv.config({ path: path.join(root, ".env"), quiet: true });
      base = `http://127.0.0.1:${process.env.API_PORT || 8787}`;
      if (stopping) throw new Error("Đã hủy khởi chạy.");
      const require = createRequire(import.meta.url);
      start("API", [require.resolve("tsx/cli"), "watch", "server/api.ts"]);
      for (let attempt = 0; !(await health()); attempt++) {
        if (stopping || attempt >= 45)
          throw new Error("API chưa sẵn sàng; xem log khởi chạy.");
        await delay(1000);
      }
      const catalog = await fetch(`${base}/api/catalog`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!catalog.ok)
        throw new Error("Danh mục chưa tải được; chưa mở giao diện.");
      start("Worker", [
        require.resolve("tsx/cli"),
        "watch",
        "server/worker.ts",
      ]);
      start("Web", [
        path.join(root, "node_modules/vite/bin/vite.js"),
        "--host",
        "127.0.0.1",
        "--port",
        "5173",
        "--strictPort",
      ]);
      console.log("Dự án đã sẵn sàng: http://127.0.0.1:5173 · Ctrl+C để dừng.");
      monitor = setInterval(async () => {
        if (stopping || recovering) return;
        if (await health()) {
          failures = 0;
          return;
        }
        if (++failures < 2) return;
        recovering = true;
        console.error("Mất kết nối dịch vụ; đang phục hồi Docker/MariaDB…");
        try {
          await startLocal();
          failures = 0;
        } catch (error) {
          console.error(error.message);
        } finally {
          recovering = false;
        }
      }, 15000);
    }
  } catch (error) {
    console.error(error.message);
    await stop();
    process.exitCode = 1;
  }
}

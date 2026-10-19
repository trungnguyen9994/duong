import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const entry = { api: "server/api.ts", worker: "server/worker.ts" }[process.argv[2]];
if (!entry) {
  console.error("Usage: node scripts/start-production.mjs api|worker");
  process.exit(1);
}
const root = fileURLToPath(new URL("../", import.meta.url));
const child = spawn(process.execPath, ["--import", "tsx", entry], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import "dotenv/config";
const inspect = (name) => {
  try {
    return JSON.parse(
      execFileSync("docker", ["inspect", name], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    )[0];
  } catch {
    return null;
  }
};
let container =
  process.env.DB_CONTAINER ||
  (inspect("laradock-mariadb-1") ? "laradock-mariadb-1" : "edugame-mariadb");
if (!inspect(container))
  execFileSync(
    "docker",
    [
      "run",
      "-d",
      "--name",
      container,
      "--restart",
      "unless-stopped",
      "-p",
      `127.0.0.1:${process.env.DB_PORT || 3306}:3306`,
      "-v",
      "edugame_mariadb:/var/lib/mysql",
      "-e",
      `MARIADB_ROOT_PASSWORD=${randomBytes(32).toString("hex")}`,
      "mariadb:10.11",
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
else if (!inspect(container).State.Running)
  execFileSync("docker", ["start", container], { stdio: "ignore" });
if (!inspect("edugame-mailpit"))
  execFileSync(
    "docker",
    [
      "run",
      "-d",
      "--name",
      "edugame-mailpit",
      "--restart",
      "unless-stopped",
      "-p",
      "127.0.0.1:55425:1025",
      "-p",
      "127.0.0.1:8025:8025",
      "axllent/mailpit:v1.31.3",
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
else if (!inspect("edugame-mailpit").State.Running)
  execFileSync("docker", ["start", "edugame-mailpit"], { stdio: "ignore" });
for (let n = 0; n < 60; n++) {
  try {
    execFileSync(
      "docker",
      [
        "exec",
        container,
        "sh",
        "-c",
        'MYSQL_PWD="${MARIADB_ROOT_PASSWORD:-$MYSQL_ROOT_PASSWORD}" $(command -v mariadb || command -v mysql) -uroot -e "SELECT 1"',
      ],
      { stdio: "ignore" },
    );
    break;
  } catch {
    if (n === 59) throw Error("MariaDB chưa sẵn sàng.");
    await new Promise((r) => setTimeout(r, 1000));
  }
}
execFileSync(process.execPath, ["scripts/setup-mariadb.mjs"], {
  env: { ...process.env, DB_CONTAINER: container },
  stdio: "inherit",
});
console.log("MariaDB và hộp thư local đã sẵn sàng. Chạy npm run dev:all.");

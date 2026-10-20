import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import mysql from "mysql2/promise";
import { ensureDocker, dockerExecutable } from "./docker-ready.mjs";
import "dotenv/config";

export async function startLocal() {
  if (
    process.env.NODE_ENV === "production" ||
    ![undefined, "localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST)
  )
    throw new Error("Lệnh local chỉ dùng với database trên máy phát triển.");
  await ensureDocker();
  const docker = (args, options) => {
    try {
      return execFileSync(dockerExecutable, args, {
        windowsHide: true,
        ...options,
      });
    } catch (error) {
      // execFileSync's default message includes argv, which may contain a new DB secret.
      throw Object.assign(
        new Error(
          `Không thực hiện được Docker ${args[0]} (mã ${error.status ?? error.code ?? "UNKNOWN"}).`,
        ),
        { code: error.code },
      );
    }
  };
  const inspect = (name) => {
    try {
      return JSON.parse(
        docker(["inspect", name], {
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
  const created = !inspect(container);
  if (created)
    docker(
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
    docker(["start", container], { stdio: "ignore" });
  if (!inspect("edugame-mailpit"))
    docker(
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
    docker(["start", "edugame-mailpit"], {
      stdio: "ignore",
    });
  for (let n = 0; n < 60; n++) {
    try {
      docker(
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
  let bootstrap =
    created ||
    !process.env.DB_USER ||
    !process.env.DB_PASSWORD ||
    !process.env.DB_NAME;
  if (!bootstrap) {
    for (let attempt = 0; attempt < 15; attempt++) {
      let connection;
      try {
        connection = await mysql.createConnection({
          host: process.env.DB_HOST || "127.0.0.1",
          port: Number(process.env.DB_PORT || 3306),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          connectTimeout: 3000,
        });
        await connection.query("SELECT id FROM subjects LIMIT 1");
        await connection.query("SELECT type FROM templates LIMIT 1");
        break;
      } catch (error) {
        if (["ER_BAD_DB_ERROR", "ER_NO_SUCH_TABLE"].includes(error.code)) {
          bootstrap = true;
          break;
        } else if (
          [
            "ECONNREFUSED",
            "ECONNRESET",
            "ETIMEDOUT",
            "PROTOCOL_CONNECTION_LOST",
          ].includes(error.code) &&
          attempt < 14
        )
          await new Promise((resolve) => setTimeout(resolve, 1000));
        else
          throw new Error(
            `Không kết nối được MariaDB bằng cấu hình hiện tại (${error.code || "DB_ERROR"}). Kiểm tra .env; cấu hình không bị ghi đè.`,
          );
      } finally {
        await connection?.end();
      }
    }
  }
  if (bootstrap)
    execFileSync(process.execPath, ["scripts/setup-mariadb.mjs"], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      windowsHide: true,
      env: { ...process.env, DB_CONTAINER: container },
      stdio: "inherit",
    });
  console.log("MariaDB và hộp thư local đã sẵn sàng.");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.chdir(fileURLToPath(new URL("../", import.meta.url)));
  startLocal().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

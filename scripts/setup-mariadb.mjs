import { execFileSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  existsSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config({quiet:true});

const name = "supabase_db_duong",
  container = process.env.DB_CONTAINER || "laradock-mariadb-1";
const rootSql = (sql) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "sh",
      "-c",
      'MYSQL_PWD="${MARIADB_ROOT_PASSWORD:-$MYSQL_ROOT_PASSWORD}" exec $(command -v mariadb || command -v mysql) -uroot --default-character-set=utf8mb4 -N',
    ],
    { input: sql, encoding: "utf8" },
  );
const existing = existsSync(".env") ? dotenv.parse(readFileSync(".env")) : {};
const password = existing.DB_PASSWORD || randomBytes(32).toString("hex");
rootSql(
  `CREATE DATABASE IF NOT EXISTS ${name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'edugame_app'@'%' IDENTIFIED BY ${mysql.escape(password)}; GRANT SELECT,INSERT,UPDATE,DELETE ON ${name}.* TO 'edugame_app'@'%';`,
);
rootSql(
  `USE ${name};\n` +
    readFileSync("database/migrations/001_mariadb.sql", "utf8"),
);
rootSql(
  `USE ${name};\n` +
    readFileSync("database/migrations/002_template_guard.sql", "utf8") + "\n" + readFileSync("database/migrations/003_usernames.sql", "utf8"),
);
mkdirSync("backups/before-mariadb", { recursive: true });
if (existsSync(".env") && !existsSync("backups/before-mariadb/.env"))
  copyFileSync(".env", "backups/before-mariadb/.env");
if (
  existsSync(".env.local") &&
  !existsSync("backups/before-mariadb/.env.local")
)
  copyFileSync(".env.local", "backups/before-mariadb/.env.local");
const settings = {
  DB_CONTAINER: container,
  DB_HOST: "127.0.0.1",
  DB_PORT: process.env.DB_PORT || existing.DB_PORT || "3306",
  DB_NAME: name,
  DB_USER: "edugame_app",
  DB_PASSWORD: password,
  API_PORT: "8787",
  API_PUBLIC_URL: "http://127.0.0.1:8787",
  FRONTEND_URL: "http://127.0.0.1:5173",
  STORAGE_ROOT: "data/storage",
  STORAGE_SIGNING_SECRET:
    existing.STORAGE_SIGNING_SECRET || randomBytes(48).toString("hex"),
  INTERNAL_WORKER_SECRET:
    existing.INTERNAL_WORKER_SECRET || randomBytes(32).toString("hex"),
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "55425",
  MAIL_FROM: "EduGame Studio <no-reply@edugame.local>",
};
writeFileSync(
  ".env",
  Object.entries(settings)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join("\n") + "\n",
);
writeFileSync(
  ".env.local",
  "VITE_API_URL=http://127.0.0.1:8787\nVITE_LOCAL_MAIL_URL=http://127.0.0.1:8025\n",
);
const connection = await mysql.createConnection({
  host: settings.DB_HOST,
  port: Number(settings.DB_PORT),
  user: settings.DB_USER,
  password,
  database: name,
});
const [tables] = await connection.query("SHOW TABLES");
console.log(
  `MariaDB: ${name}, ${tables.length} bảng, user ứng dụng riêng; cấu hình đã lưu trong .env.`,
);
await connection.end();

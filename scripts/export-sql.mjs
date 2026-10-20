import "dotenv/config";
import { spawn, execFileSync } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createHash, randomBytes } from "node:crypto";
import { resolve } from "node:path";

const database = process.env.DB_NAME || "supabase_db_duong";
const container = process.env.DB_CONTAINER || "laradock-mariadb-1";
if (!/^[a-zA-Z0-9_]+$/.test(database)) throw Error("Invalid database name");
const destination = resolve("backups", `duong-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`);
const temporary = `edugame_sql_check_${randomBytes(8).toString("hex")}`;
const client = 'MYSQL_PWD="${MARIADB_ROOT_PASSWORD:-$MYSQL_ROOT_PASSWORD}" exec $(command -v mariadb || command -v mysql) -uroot --default-character-set=utf8mb4 --batch --skip-column-names';
const rootSql = (query) => execFileSync("docker", ["exec", "-i", container, "sh", "-c", client], {
  input: query, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"],
});
const ident = (value) => `\`${String(value).replaceAll("`", "``")}\``;
const tables = (db) => rootSql(`SHOW FULL TABLES FROM ${ident(db)} WHERE Table_type='BASE TABLE';`)
  .trim().split("\n").filter(Boolean).map((line) => line.split("\t")[0]);
const summary = (db, names) => Object.fromEntries(names.map((table) => [table, {
  rows: Number(rootSql(`SELECT COUNT(*) FROM ${ident(db)}.${ident(table)};`).trim()),
  checksum: rootSql(`CHECKSUM TABLE ${ident(db)}.${ident(table)} EXTENDED;`).trim().split("\t")[1],
}]));

await mkdir(resolve("backups"), { recursive: true });
let temporaryCreated = false;
try {
  const dump = spawn("docker", ["exec", container, "sh", "-c",
    'MYSQL_PWD="${MARIADB_ROOT_PASSWORD:-$MYSQL_ROOT_PASSWORD}" exec $(command -v mariadb-dump || command -v mysqldump) -uroot --single-transaction --quick --skip-lock-tables --hex-blob --routines --events --triggers --default-character-set=utf8mb4 "$1"',
    "export-sql", database], { stdio: ["ignore", "pipe", "pipe"] });
  let dumpError = false;
  dump.stderr.on("data", () => { dumpError = true; });
  const finished = new Promise((resolveExit, reject) => {
    dump.once("error", reject);
    dump.once("close", (code) => code === 0 ? resolveExit() : reject(Error("MariaDB dump failed; partial SQL is not verified")));
  });
  await Promise.all([
    pipeline(dump.stdout, createWriteStream(destination, { flags: "wx", mode: 0o600 })),
    finished,
  ]);
  const sourceNames = tables(database);
  const sourceSummary = summary(database, sourceNames);
  rootSql(`CREATE DATABASE ${ident(temporary)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  temporaryCreated = true;
  const restore = spawn("docker", ["exec", "-i", container, "sh", "-c", `${client} "$1"`, "restore-sql", temporary], {
    stdio: ["pipe", "ignore", "pipe"],
  });
  restore.stderr.on("data", () => {});
  const restored = new Promise((resolveExit, reject) => {
    restore.once("error", reject);
    restore.once("close", (code) => code === 0 ? resolveExit() : reject(Error("Isolated SQL restore failed")));
  });
  await Promise.all([pipeline(createReadStream(destination), restore.stdin), restored]);
  const restoredNames = tables(temporary);
  if (JSON.stringify([...sourceNames].sort()) !== JSON.stringify([...restoredNames].sort())) {
    throw Error("Restored table list differs from source");
  }
  const restoredSummary = summary(temporary, restoredNames);
  for (const name of sourceNames) {
    if (JSON.stringify(sourceSummary[name]) !== JSON.stringify(restoredSummary[name])) {
      throw Error(`Source and restored content differ for ${name}; source may have changed during verification`);
    }
    if (!sourceSummary[name].checksum || sourceSummary[name].checksum === "NULL") {
      throw Error(`Checksum unavailable for ${name}`);
    }
  }
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(destination)) hash.update(chunk);
  const report = {
    createdAt: new Date().toISOString(), database, sqlFile: destination,
    bytes: (await stat(destination)).size, sha256: hash.digest("hex"),
    verified: true, verification: "Imported SQL into isolated database; table lists, row counts and extended checksums matched",
    tables: restoredSummary, dumpStderrPresent: dumpError,
    includesStorageFiles: false,
  };
  await writeFile(`${destination}.manifest.json`, JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ file: destination, bytes: report.bytes, tables: sourceNames.length,
    rows: Object.values(restoredSummary).reduce((sum, table) => sum + table.rows, 0),
    restoreVerified: true, sha256: report.sha256 }));
} catch (error) {
  // SQL data, passwords and server stderr must never be printed.
  console.error(error.code ? `SQL export failed (${error.code}); secrets hidden.` : error.message);
  process.exitCode = 1;
} finally {
  if (temporaryCreated) {
    rootSql(`DROP DATABASE ${ident(temporary)};`);
    console.log("Removed isolated verification database; source database unchanged.");
  }
}

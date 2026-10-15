import { execFileSync } from "node:child_process";
import { readFile, mkdir, copyFile, rm } from "node:fs/promises";
import { resolve, sep, dirname } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import mysql from "mysql2";
import { createBackup } from "./backup";
import { pool, encode, decode } from "./database";
const stable=(v:any):any=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const fingerprint=(rows:any[])=>createHash("sha256").update(rows.map(row=>JSON.stringify(stable(row))).sort().join("\n")).digest("hex");
const destination = process.argv[2]
  ? resolve(process.argv[2])
  : await createBackup();
if (!destination.startsWith(resolve("backups") + sep))
  throw Error("Chỉ nhận bản sao lưu trong backups/.");
const target = `edugame_restore_${randomBytes(8).toString("hex")}`,
  container = process.env.DB_CONTAINER || "laradock-mariadb-1";
const rootSql = (query: string) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "sh",
      "-c",
      'MYSQL_PWD="${MARIADB_ROOT_PASSWORD:-$MYSQL_ROOT_PASSWORD}" exec $(command -v mariadb || command -v mysql) -uroot --default-character-set=utf8mb4 -N --raw --batch',
    ],
    { input: query, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 },
  );
const temp = resolve(destination, `.restore-files-${target}`);
try {
  rootSql(
    `CREATE DATABASE \`${target}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; USE \`${target}\`;` +
      (await readFile("database/migrations/001_mariadb.sql", "utf8")),
  );
  const data = JSON.parse(
    await readFile(resolve(destination, "database.json"), "utf8"),
  );
  const statements = [`USE \`${target}\`; SET FOREIGN_KEY_CHECKS=0;`];
  for (const [table, rows] of Object.entries(data)) {
    if (!/^[a-z_]+$/.test(table)) throw Error("INVALID_TABLE");
    statements.push(`DELETE FROM \`${table}\`;`);
    for (const row of rows as Record<string, unknown>[]) {
      const keys = Object.keys(row);
      statements.push(
        `INSERT INTO \`${table}\` (${keys.map((k) => mysql.escapeId(k)).join(",")}) VALUES (${keys.map((k) => mysql.escape(encode(k, row[k]), false, "Z")).join(",")});`,
      );
    }
  }
  statements.push("SET FOREIGN_KEY_CHECKS=1;");
  rootSql(statements.join("\n"));
  for (const [table, rows] of Object.entries(data)) {
    const count = Number(
      rootSql(`SELECT COUNT(*) FROM \`${target}\`.\`${table}\`;`).trim(),
    );
    if (count !== (rows as unknown[]).length)
      throw Error(`Sai số dòng: ${table}`);
    const expected=rows as Record<string,unknown>[];
    if(expected.length){
      const pairs=Object.keys(expected[0]).flatMap(k=>[mysql.escape(k),mysql.escapeId(k)]).join(",");
      const actual=rootSql(`SELECT JSON_OBJECT(${pairs}) FROM \`${target}\`.\`${table}\`;`).trim().split("\n").map(line=>decode(JSON.parse(line)));
      if(fingerprint(actual)!==fingerprint(expected))throw Error(`Sai nội dung bảng: ${table}`);
    }
  }
  const manifest = JSON.parse(
    await readFile(resolve(destination, "manifest.json"), "utf8"),
  );
  for (const file of manifest.files) {
    const source = resolve(destination, "storage", file.path),
      out = resolve(temp, file.path);
    if (
      !source.startsWith(resolve(destination, "storage") + sep) ||
      !out.startsWith(temp + sep)
    )
      throw Error("INVALID_PATH");
    await mkdir(dirname(out), { recursive: true });
    await copyFile(source, out);
    const bytes = await readFile(out);
    if (
      bytes.length !== file.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== file.sha256
    )
      throw Error("Sai checksum file");
  }
  console.log(
    `PASS: khôi phục ${Object.keys(data).length} bảng vào database cách ly và ${manifest.files.length} file; kiểm tra số dòng/checksum thành công.`,
  );
} finally {
  rootSql(`DROP DATABASE IF EXISTS \`${target}\`;`);
  await rm(temp, { recursive: true, force: true });
  await pool.end();
}

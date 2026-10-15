import { pool, sql, transaction } from "./database";
import {
  mkdir,
  writeFile,
  readFile,
  readdir,
  copyFile,
} from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
import { createHash } from "node:crypto";
import { storageRoot } from "./storage";
import { pathToFileURL } from "node:url";
export async function createBackup() {
  const destination = resolve(
    "backups",
    `mariadb-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  );
  await mkdir(destination, { recursive: true });
  const database = await transaction(async (c) => {
    const tables = await sql("SHOW TABLES", [], c);
    const rows: Record<string, unknown> = {};
    for (const table of tables) {
      const name = String(Object.values(table)[0]);
      if (!/^[a-z_]+$/.test(name)) throw Error("INVALID_TABLE");
      rows[name] = await sql(`SELECT * FROM \`${name}\``, [], c);
    }
    return rows;
  });
  await writeFile(
    resolve(destination, "database.json"),
    JSON.stringify(database),
  );
  const files: { path: string; sha256: string; bytes: number }[] = [];
  async function copy(dir: string) {
    for (const item of await readdir(dir, { withFileTypes: true }).catch(
      () => [],
    )) {
      const source = resolve(dir, item.name);
      if (item.isSymbolicLink()) throw Error("Không sao lưu symlink.");
      if (item.isDirectory()) {
        await copy(source);
        continue;
      }
      const path = relative(storageRoot, source).replaceAll("\\", "/");
      const target = resolve(destination, "storage", path);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(source, target);
      const bytes = await readFile(target);
      files.push({
        path,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
  await copy(storageRoot);
  await writeFile(
    resolve(destination, "manifest.json"),
    JSON.stringify(
      { database: "mariadb", createdAt: new Date().toISOString(), files },
      null,
      2,
    ),
  );
  console.log(
    `Đã sao lưu ${Object.keys(database).length} bảng và ${files.length} file vào ${destination}.`,
  );
  return destination;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await createBackup();
  } finally {
    await pool.end();
  }
}

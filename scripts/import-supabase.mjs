// One-time migration only. Runtime uses MariaDB and local private files.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, sep } from "node:path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { createClient } from "@supabase/supabase-js";
dotenv.config({ quiet: true });
const pg = (query) =>
  JSON.parse(
    execFileSync(
      "docker",
      [
        "exec",
        "supabase_db_duong",
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-tA",
        "-c",
        query,
      ],
      { encoding: "utf8" },
    ),
  );
const target = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
const [counts] = await target.query(
  "SELECT (SELECT COUNT(*) FROM users)+(SELECT COUNT(*) FROM games)+(SELECT COUNT(*) FROM assets) AS n",
);
if (counts[0].n)
  throw Error(
    "Database đích đã có dữ liệu. Dừng để tránh ghi đè; phục hồi/import cần kế hoạch riêng.",
  );
mkdirSync("backups/before-mariadb", { recursive: true });
writeFileSync(
  "backups/before-mariadb/postgres.sql",
  execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_duong",
      "pg_dump",
      "-U",
      "postgres",
      "--no-owner",
      "postgres",
    ],
    { maxBuffer: 128 * 1024 * 1024 },
  ),
);
const users = pg(
  "SELECT COALESCE(json_agg(t),'[]'::json) FROM (SELECT id,email,encrypted_password AS password_hash,email_confirmed_at,created_at FROM auth.users) t",
);
const tables = [
  "profiles",
  "app_settings",
  "subjects",
  "templates",
  "template_versions",
  "assets",
  "games",
  "asset_references",
  "questions",
  "play_sessions",
  "jobs",
  "share_links",
  "audit_log",
];
const snapshots = Object.fromEntries(
  tables.map((table) => [
    table,
    pg(`SELECT COALESCE(json_agg(t),'[]'::json) FROM public.${table} t`),
  ]),
);
// Copy binaries before committing metadata; source files and original DB stay intact.
const old = dotenv.parse(readFileSync("backups/before-mariadb/.env"));
const legacy = createClient(old.SUPABASE_URL, old.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
let files = 0;
async function copy(bucket, prefix = "") {
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await legacy.storage
      .from(bucket)
      .list(prefix, { offset, limit: 100 });
    if (error) throw error;
    for (const f of data) {
      const path = prefix ? prefix + "/" + f.name : f.name;
      if (!f.id) {
        await copy(bucket, path);
        continue;
      }
      const { data: blob, error: err } = await legacy.storage
        .from(bucket)
        .download(path);
      if (err) throw err;
      const base = resolve(process.env.STORAGE_ROOT, bucket),
        dest = resolve(base, path);
      if (!dest.startsWith(base + sep)) throw Error("INVALID_PATH");
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, Buffer.from(await blob.arrayBuffer()));
      files++;
    }
    if (data.length < 100) break;
  }
}
await copy("media");
await copy("uploads");
const json = new Set([
  "permissions",
  "value",
  "config",
  "spec",
  "body",
  "result",
  "payload",
  "snapshot",
  "details",
]);
await target.beginTransaction();
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])) : value;
try {
  for (const [table, rows] of [["users", users], ...Object.entries(snapshots)])
    for (const row of rows) {
      if(table === "template_versions") {
        const [found] = await target.query("SELECT released,config FROM template_versions WHERE template_type=? AND version=?",[row.template_type,row.version]);
        if(found.length) {
          const config=typeof found[0].config === "string" ? JSON.parse(found[0].config) : found[0].config;
          if(!!found[0].released !== row.released || JSON.stringify(stable(config)) !== JSON.stringify(stable(row.config))) throw Error("TEMPLATE_VERSION_CONFLICT: cần đối chiếu registry trước khi nhập.");
          continue;
        }
      }
      const columns = Object.keys(row);
      const values = columns.map((k) =>
        json.has(k)
          ? JSON.stringify(row[k])
          : typeof row[k] === "string" && /^\d{4}-\d\d-\d\dT/.test(row[k])
            ? new Date(row[k])
            : row[k],
      );
      const insert = table === "template_versions" ? "INSERT IGNORE" : "INSERT";
      const suffix =
        table === "template_versions"
          ? ""
          : ` ON DUPLICATE KEY UPDATE ${columns.map((k) => "`" + k + "`=VALUES(`" + k + "`)").join(",")}`;
      await target.query(
        `${insert} INTO \`${table}\` (${columns.map((k) => "`" + k + "`").join(",")}) VALUES (${columns.map(() => "?").join(",")})${suffix}`,
        values,
      );
    }
  await target.commit();
} catch (e) {
  await target.rollback();
  throw e;
} finally {
  await target.end();
}
console.log(
  JSON.stringify({
    users: users.length,
    tables: Object.fromEntries(
      Object.entries(snapshots).map(([k, v]) => [k, v.length]),
    ),
    files,
  }),
);

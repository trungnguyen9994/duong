import "dotenv/config";
import mysql, { type PoolConnection } from "mysql2/promise";
import { randomUUID } from "node:crypto";

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "supabase_db_duong",
  charset: "utf8mb4",
  timezone: "Z",
  dateStrings: true,
  connectionLimit: 10,
  supportBigNumbers: true,
  bigNumberStrings: false,
});
export type Row = Record<string, any>;
const jsonColumns = new Set([
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
const boolColumns = new Set(["approved", "enabled", "released"]);
export function decode(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k,
      jsonColumns.has(k) && typeof v === "string"
        ? JSON.parse(v)
        : boolColumns.has(k)
          ? !!v
          : /_at$|lease_until|expires_at/.test(k) && typeof v === "string"
            ? v.replace(" ", "T") + "Z"
            : v,
    ]),
  );
}
export function encode(k: string, v: any): any {
  return jsonColumns.has(k)
    ? JSON.stringify(v)
    : typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v)
      ? new Date(v)
      : v === undefined
        ? null
        : v;
}
export async function sql(
  query: string,
  values: any[] = [],
  connection?: PoolConnection,
): Promise<Row[]> {
  const [rows] = await (connection || pool).query(query, values);
  return Array.isArray(rows) ? (rows as Row[]).map(decode) : [];
}
export async function transaction<T>(
  fn: (c: PoolConnection) => Promise<T>,
): Promise<T> {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const value = await fn(c);
    await c.commit();
    return value;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
export function ident(value: string) {
  if (!/^[a-z_][a-z_0-9]*$/i.test(value)) throw Error("INVALID_IDENTIFIER");
  return `\`${value}\``;
}
const tables = new Set([
  "users",
  "profiles",
  "app_settings",
  "subjects",
  "templates",
  "template_versions",
  "assets",
  "games",
  "questions",
  "play_sessions",
  "jobs",
  "share_links",
  "asset_references",
  "audit_log",
  "auth_sessions",
  "auth_tokens",
]);
export type Result = {
  data: any;
  error: { message: string } | null;
  count?: number;
};
export async function result(fn: () => Promise<any>): Promise<Result> {
  try {
    return { data: await fn(), error: null };
  } catch (e) {
    return {
      data: null,
      error: { message: e instanceof Error ? e.message : String(e) },
    };
  }
}

/** Server-only query builder. Browser input never chooses a table, column or filter. */
export class Query implements PromiseLike<Result> {
  private filters: string[] = [];
  private args: any[] = [];
  private columns = "*";
  private action = "select";
  private rows: Row[] = [];
  private singleMode = "";
  private cap = 10000;
  private sort = "";
  private count = false;
  private head = false;
  private options: Row = {};
  constructor(private table: string) {
    if (!tables.has(table)) throw Error("UNKNOWN_TABLE");
  }
  select(columns = "*", options: Row = {}) {
    this.columns = columns;
    this.count = !!options.count;
    this.head = !!options.head;
    return this;
  }
  eq(k: string, v: any) {
    return this.filter(k, "=", v);
  }
  neq(k: string, v: any) {
    return this.filter(k, "<>", v);
  }
  lt(k: string, v: any) {
    return this.filter(k, "<", v);
  }
  private column(k: string) {
    const [field, path] = k.split("->>");
    return path
      ? `JSON_UNQUOTE(JSON_EXTRACT(${ident(field)}, '$.${path.replace(/[^a-zA-Z0-9_]/g, "")}'))`
      : ident(k);
  }
  private filter(k: string, op: string, v: any) {
    this.filters.push(`${this.column(k)} ${op} ?`);
    this.args.push(encode(k, v));
    return this;
  }
  is(k: string, v: null) {
    this.filters.push(`${ident(k)} IS NULL`);
    return this;
  }
  in(k: string, values: any[]) {
    this.filters.push(
      values.length
        ? `${ident(k)} IN (${values.map(() => "?").join(",")})`
        : "FALSE",
    );
    this.args.push(...values);
    return this;
  }
  contains(k: string, v: any) {
    this.filters.push(`JSON_CONTAINS(${ident(k)}, ?)`);
    this.args.push(JSON.stringify(v));
    return this;
  }
  or(expression: string) {
    const match = expression.match(
      /^owner_id.eq.([0-9a-f-]{36}),and\(owner_id.is.null,approved.eq.true\)$/i,
    );
    if (!match) throw Error("INVALID_FILTER");
    this.filters.push("(owner_id=? OR (owner_id IS NULL AND approved=TRUE))");
    this.args.push(match[1]);
    return this;
  }
  order(k: string, opts: Row = {}) {
    this.sort = ` ORDER BY ${ident(k)} ${opts.ascending === false ? "DESC" : "ASC"}`;
    return this;
  }
  limit(n: number) {
    this.cap = Math.max(0, Math.min(10000, n));
    return this;
  }
  single() {
    this.singleMode = "required";
    return this;
  }
  maybeSingle() {
    this.singleMode = "optional";
    return this;
  }
  insert(row: Row | Row[]) {
    this.action = "insert";
    this.rows = Array.isArray(row) ? row : [row];
    return this;
  }
  upsert(row: Row, opts: Row = {}) {
    this.action = "upsert";
    this.rows = [row];
    this.options = opts;
    return this;
  }
  update(row: Row) {
    this.action = "update";
    this.rows = [row];
    return this;
  }
  delete() {
    this.action = "delete";
    return this;
  }
  then<TResult1 = Result, TResult2 = never>(
    fulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    rejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(fulfilled, rejected);
  }
  private async run(): Promise<Result> {
    let totalCount: number | undefined;
    const response = await result(() =>
      transaction(async (c) => {
        const execute = (query: string, values: any[] = []) =>
          sql(query, values, c);
        const table = ident(this.table),
          where = this.filters.length
            ? " WHERE " + this.filters.join(" AND ")
            : "";
        let rows: Row[] = [];
        if (this.action === "insert" || this.action === "upsert") {
          for (const original of this.rows) {
            const row = { ...original };
            if (
              !row.id &&
              ![
                "app_settings",
                "templates",
                "template_versions",
                "asset_references",
                "auth_sessions",
                "auth_tokens",
              ].includes(this.table) &&
              this.table !== "audit_log"
            )
              row.id = randomUUID();
            const keys = Object.keys(row),
              conflict =
                this.options.onConflict ||
                (this.table === "app_settings"
                  ? "key"
                  : this.table === "templates"
                    ? "type"
                    : "id");
            const suffix =
              this.action === "upsert"
                ? ` ON DUPLICATE KEY UPDATE ${this.options.ignoreDuplicates ? `${ident(conflict)}=${ident(conflict)}` : keys.map((k) => `${ident(k)}=VALUES(${ident(k)})`).join(",")}`
                : "";
            await execute(
              `INSERT INTO ${table} (${keys.map(ident).join(",")}) VALUES (${keys.map(() => "?").join(",")})${suffix}`,
              keys.map((k) => encode(k, row[k])),
            );
            if (row.id)
              rows.push(
                ...(await execute(`SELECT * FROM ${table} WHERE id=?`, [
                  row.id,
                ])),
              );
            else rows.push(row);
          }
        } else if (this.action === "update" || this.action === "delete") {
          if (!where) throw Error("UNSCOPED_MUTATION");
          rows = await execute(
            `SELECT * FROM ${table}${where} FOR UPDATE`,
            this.args,
          );
          if (this.action === "update") {
            const keys = Object.keys(this.rows[0]);
            await execute(
              `UPDATE ${table} SET ${keys.map((k) => `${ident(k)}=?`).join(",")}${where}`,
              [...keys.map((k) => encode(k, this.rows[0][k])), ...this.args],
            );
            rows = rows.map((r) => ({ ...r, ...this.rows[0] }));
          } else await execute(`DELETE FROM ${table}${where}`, this.args);
        } else {
          let columns = this.columns;
          if (columns.includes("templates(")) columns = "*";
          const selection =
            columns === "*" ? "*" : columns.split(",").map(ident).join(",");
          rows = await execute(
            `SELECT ${selection} FROM ${table}${where}${this.sort} LIMIT ${this.cap}`,
            this.args,
          );
          if (this.count)
            totalCount = Number(
              (
                await execute(
                  `SELECT COUNT(*) AS n FROM ${table}${where}`,
                  this.args,
                )
              )[0].n,
            );
          if (this.columns.includes("templates("))
            for (const row of rows)
              row.templates = (
                await execute(
                  "SELECT name,enabled FROM templates WHERE type=?",
                  [row.template_type],
                )
              )[0];
        }
        if (this.singleMode) {
          if (
            rows.length > 1 ||
            (!rows.length && this.singleMode === "required")
          )
            throw Error("NOT_FOUND");
          return rows[0] || null;
        }
        return rows;
      }),
    );
    if (this.count && !response.error)
      response.count =
        totalCount ?? (Array.isArray(response.data) ? response.data.length : 0);
    if (this.head) response.data = null;
    return response;
  }
}

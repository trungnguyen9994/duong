import { randomUUID } from "node:crypto";
import { sql, transaction, result, encode, ident, type Row } from "./database";

export const rpc = (name: string, p: Row = {}) =>
  result(() =>
    transaction(async (c) => {
      const q = (s: string, v: any[] = []) => sql(s, v, c);
      const one = async (s: string, v: any[] = []) => (await q(s, v))[0];
      const requireRow = (row: Row | undefined, code = "NOT_FOUND") => {
        if (!row) throw Error(code);
        return row;
      };
      const profile = async (id: string) =>
        requireRow(
          await one("SELECT * FROM profiles WHERE id=? FOR UPDATE", [id]),
          "ACCOUNT_INACTIVE",
        );
      const active = async (id: string) => {
        const a = await profile(id);
        if (a.status !== "active") throw Error("ACCOUNT_INACTIVE");
        return a;
      };
      const audit = async (
        actor: string,
        action: string,
        target: string,
        details: Row = {},
      ) =>
        q(
          "INSERT INTO audit_log(actor_id,action,target_id,details) VALUES (?,?,?,?)",
          [actor, action, target, JSON.stringify(details)],
        );
      const update = async (table: string, id: string, patch: Row) =>
        q(
          `UPDATE ${ident(table)} SET ${Object.keys(patch)
            .map((k) => `${ident(k)}=?`)
            .join(",")} WHERE id=?`,
          [...Object.entries(patch).map(([k, v]) => encode(k, v)), id],
        );
      const usage = async (owner: string) =>
        Number(
          (
            await one(
              "SELECT COALESCE(SUM(bytes),0) AS n FROM assets WHERE owner_id=?",
              [owner],
            )
          ).n,
        ) +
        Number(
          (
            await one(
              "SELECT COALESCE(SUM(CASE WHEN status IN ('queued','running') THEN 52428800 WHEN status='completed' THEN COALESCE(JSON_EXTRACT(result,'$.bytes'),0) ELSE 0 END),0) AS n FROM jobs WHERE owner_id=? AND kind='export'",
              [owner],
            )
          ).n,
        );
      const assets = async (ids: string[], owner: string) => {
        for (const id of [...new Set(ids)].sort()) {
          const a = await one(
            "SELECT * FROM assets WHERE id=? LOCK IN SHARE MODE",
            [id],
          );
          if (
            !a ||
            a.status !== "ready" ||
            (a.owner_id !== owner && !(a.owner_id === null && a.approved))
          )
            throw Error("ASSET_FORBIDDEN");
        }
      };
      const revoke = async (id: string) =>
        q(
          "UPDATE share_links SET revoked_at=UTC_TIMESTAMP(3) WHERE game_id=? AND revoked_at IS NULL",
          [id],
        );
      const game = async (id: string, revision: number, owner?: string) => {
        const g = requireRow(
          await one("SELECT * FROM games WHERE id=? FOR UPDATE", [id]),
          "REVISION_CONFLICT",
        );
        if (g.revision !== revision) throw Error("REVISION_CONFLICT");
        if (owner && g.owner_id !== owner) throw Error("FORBIDDEN");
        return g;
      };
      if (name === "save_game") {
        await active(p.p_owner);
        const spec = p.p_spec;
        if (spec.kind !== spec.template.type) throw Error("TEMPLATE_MISMATCH");
        if (
          !(await one(
            "SELECT * FROM template_versions WHERE template_type=? AND version=?",
            [spec.template.type, spec.template.version],
          ))
        )
          throw Error("UNKNOWN_TEMPLATE");
        const subject = await one("SELECT * FROM subjects WHERE id=?", [
          spec.metadata.subjectId,
        ]);
        if (!subject) throw Error("UNKNOWN_SUBJECT");
        const old = await one("SELECT * FROM games WHERE id=? FOR UPDATE", [
          spec.id,
        ]);
        if (old) {
          if (old.owner_id !== p.p_owner) throw Error("FORBIDDEN");
          if (old.revision !== p.p_revision) throw Error("REVISION_CONFLICT");
          if (old.spec.template.type !== spec.template.type)
            throw Error("COPY_REQUIRED");
          if (
            old.spec.metadata.subjectId !== spec.metadata.subjectId &&
            !subject.enabled
          )
            throw Error("SUBJECT_DISABLED");
        } else {
          if (p.p_revision !== 0) throw Error("REVISION_CONFLICT");
          if (!subject.enabled) throw Error("SUBJECT_DISABLED");
          const t = await one("SELECT enabled FROM templates WHERE type=?", [
            spec.template.type,
          ]);
          if (!t?.enabled) throw Error("TEMPLATE_DISABLED");
        }
        await assets(p.p_assets, p.p_owner);
        if (old) {
          await update("games", spec.id, {
            spec,
            revision: old.revision + 1,
            status: "draft",
            updated_at: new Date(),
          });
          await revoke(spec.id);
        } else
          await q("INSERT INTO games(id,owner_id,spec) VALUES (?,?,?)", [
            spec.id,
            p.p_owner,
            JSON.stringify(spec),
          ]);
        await q("DELETE FROM asset_references WHERE game_id=?", [spec.id]);
        for (const id of new Set(p.p_assets))
          await q("INSERT INTO asset_references VALUES (?,?)", [spec.id, id]);
        return one("SELECT * FROM games WHERE id=?", [spec.id]);
      }
      if (name === "reserve_job") {
        const a = await active(p.p_owner),
          kind = p.p_kind;
        const existing = await one(
          "SELECT * FROM jobs WHERE owner_id=? AND kind=? AND idempotency_key=?",
          [a.id, kind, p.p_key],
        );
        if (existing) return existing;
        const count = Number(
          (
            await one(
              "SELECT COUNT(*) AS n FROM jobs WHERE owner_id=? AND kind=? AND status IN ('queued','running')",
              [a.id, kind],
            )
          ).n,
        );
        if (kind === "upload") {
          const today = await one(
            "SELECT COUNT(*) AS n FROM jobs WHERE owner_id=? AND kind='upload' AND created_at>=UTC_DATE()",
            [a.id],
          );
          if (Number(today.n) >= 200) throw Error("UPLOAD_DAILY_QUOTA");
          if (!p.p_bytes || p.p_bytes > 5242880) throw Error("FILE_SIZE");
          if (count >= a.upload_limit) throw Error("UPLOAD_CONCURRENCY");
          if ((await usage(a.id)) + p.p_bytes > a.storage_limit)
            throw Error("STORAGE_QUOTA");
          await q(
            "INSERT INTO assets(id,owner_id,name,bytes,path) VALUES (?,?,?,?,?)",
            [
              p.p_payload.assetId,
              a.id,
              p.p_payload.name,
              p.p_bytes,
              p.p_payload.path,
            ],
          );
        } else if (kind === "export") {
          await assets(p.p_payload.assetIds || [], a.id);
          if ((await usage(a.id)) + 52428800 > a.storage_limit)
            throw Error("STORAGE_QUOTA");
          if (count >= a.concurrent_export_limit)
            throw Error("EXPORT_CONCURRENCY");
          if (
            Number(
              (
                await one(
                  "SELECT COUNT(*) AS n FROM jobs WHERE owner_id=? AND kind='export' AND created_at>=UTC_DATE()",
                  [a.id],
                )
              ).n,
            ) >= a.daily_export_limit
          )
            throw Error("EXPORT_DAILY_QUOTA");
        } else throw Error("UNKNOWN_JOB");
        const id = randomUUID();
        await q(
          "INSERT INTO jobs(id,owner_id,kind,idempotency_key,payload) VALUES (?,?,?,?,?)",
          [id, a.id, kind, p.p_key, JSON.stringify(p.p_payload)],
        );
        return one("SELECT * FROM jobs WHERE id=?", [id]);
      }
      if (name === "claim_job") {
        // MariaDB 10.3 has no SKIP LOCKED: serialize only the short claim transaction.
        await q(
          "SELECT value FROM app_settings WHERE `key`='queue_lock' FOR UPDATE",
        );
        await q(
          "UPDATE jobs SET status='failed',error='Đã hết số lần thử.' WHERE status='running' AND lease_until<UTC_TIMESTAMP(3) AND attempts>=3",
        );
        await q(
          "UPDATE jobs SET status='failed',error='Upload quá hạn.' WHERE kind='upload' AND status='queued' AND COALESCE(JSON_EXTRACT(payload,'$.ready'),FALSE)=FALSE AND created_at<UTC_TIMESTAMP(3)-INTERVAL 1 HOUR",
        );
        await q(
          "UPDATE assets a JOIN jobs j ON a.id=JSON_UNQUOTE(JSON_EXTRACT(j.payload,'$.assetId')) SET a.status='failed' WHERE j.status='failed' AND a.status IN ('pending','processing')",
        );
        const j = await one(
          "SELECT * FROM jobs WHERE (status='queued' OR (status='running' AND lease_until<UTC_TIMESTAMP(3))) AND attempts<3 AND (kind='export' OR JSON_EXTRACT(payload,'$.ready')=TRUE) ORDER BY created_at LIMIT 1 FOR UPDATE",
        );
        if (!j) return null;
        await update("jobs", j.id, {
          status: "running",
          attempts: j.attempts + 1,
          lease_token: randomUUID(),
          lease_until: new Date(Date.now() + 120000),
          updated_at: new Date(),
        });
        return one("SELECT * FROM jobs WHERE id=?", [j.id]);
      }
      if (name === "finish_upload" || name === "finish_export") {
        const j = requireRow(
          await one(
            "SELECT * FROM jobs WHERE id=? AND status='running' AND lease_token=? FOR UPDATE",
            [p.p_job, p.p_lease],
          ),
          "LEASE_LOST",
        );
        const a = await active(j.owner_id);
        const old =
          name === "finish_upload"
            ? Number(
                (
                  await one("SELECT bytes FROM assets WHERE id=?", [
                    j.payload.assetId,
                  ])
                ).bytes,
              )
            : 52428800;
        if (
          p.p_bytes > 52428800 ||
          (await usage(a.id)) - old + p.p_bytes > a.storage_limit
        )
          throw Error("STORAGE_QUOTA");
        if (name === "finish_upload")
          await update("assets", j.payload.assetId, {
            status: "ready",
            path: p.p_path,
            thumbnail_path: p.p_thumb,
            mime: "image/webp",
            bytes: p.p_bytes,
            width: p.p_width,
            height: p.p_height,
          });
        await update("jobs", j.id, {
          status: "completed",
          result:
            name === "finish_upload"
              ? { assetId: j.payload.assetId }
              : { path: p.p_path, bytes: p.p_bytes },
          lease_until: null,
          updated_at: new Date(),
        });
        return null;
      }
      if (name === "delete_asset") {
        const a = requireRow(
          await one(
            "SELECT * FROM assets WHERE id=? AND owner_id=? FOR UPDATE",
            [p.p_asset, p.p_owner],
          ),
        );
        const refs = await one(
          "SELECT game_id FROM asset_references WHERE asset_id=? LIMIT 1",
          [a.id],
        );
        const bank = await one(
          "SELECT id FROM questions WHERE JSON_UNQUOTE(JSON_EXTRACT(body,'$.imageId'))=? LIMIT 1",
          [a.id],
        );
        const job = await one(
          "SELECT id FROM jobs WHERE status IN ('queued','running') AND (JSON_CONTAINS(JSON_EXTRACT(payload,'$.assetIds'),?) OR JSON_UNQUOTE(JSON_EXTRACT(payload,'$.sourceAssetId'))=?) LIMIT 1",
          [JSON.stringify(a.id), a.id],
        );
        if (refs || bank || job) throw Error("ASSET_IN_USE");
        await update("assets", a.id, { status: "deleted" });
        return null;
      }
      if (["archive_game", "submit_game", "revoke_share"].includes(name)) {
        await active(p.p_owner);
        const id = p.p_id || p.p_game;
        const g = await game(id, p.p_revision, p.p_owner);
        if (name !== "submit_game") await revoke(id);
        await update("games", id, {
          status:
            name === "archive_game"
              ? "archived"
              : name === "submit_game"
                ? "pending"
                : "draft",
          revision: g.revision + 1,
          updated_at: new Date(),
        });
        await audit(p.p_owner, name, id);
        return one("SELECT * FROM games WHERE id=?", [id]);
      }
      if (name === "moderate_game") {
        const a = await active(p.p_actor);
        if (
          a.role !== "super_admin" &&
          !(a.role === "admin" && a.permissions.includes("moderation"))
        )
          throw Error("FORBIDDEN");
        const g = await game(p.p_id, p.p_revision);
        if (g.status !== "pending") throw Error("REVISION_CONFLICT");
        if (p.p_approve)
          await assets(
            (
              await q("SELECT asset_id FROM asset_references WHERE game_id=?", [
                g.id,
              ])
            ).map((r) => r.asset_id),
            g.owner_id,
          );
        await revoke(g.id);
        await update("games", g.id, {
          status: p.p_approve ? "published" : "draft",
          revision: g.revision + 1,
          updated_at: new Date(),
        });
        let id = null;
        if (p.p_approve) {
          id = randomUUID();
          await q(
            "INSERT INTO share_links(id,game_id,owner_id,snapshot) VALUES (?,?,?,?)",
            [id, g.id, g.owner_id, JSON.stringify(g.spec)],
          );
        }
        await audit(a.id, name, g.id, { approved: p.p_approve });
        return id;
      }
      if (name === "manage_account") {
        const a = await active(p.p_actor),
          t = await profile(p.p_target),
          patch = p.p_patch;
        if (
          a.role !== "super_admin" &&
          !(
            a.role === "admin" &&
            a.permissions.includes("accounts") &&
            t.role === "teacher"
          )
        )
          throw Error("FORBIDDEN");
        if (
          a.role !== "super_admin" &&
          Object.keys(patch).some((k) => k !== "status")
        )
          throw Error("SUPER_ADMIN_REQUIRED");
        if (
          a.id === t.id &&
          (patch.role !== undefined ||
            (patch.status && patch.status !== "active"))
        )
          throw Error("SELF_LOCKOUT");
        if (Object.keys(patch).length) await update("profiles", t.id, patch);
        await audit(a.id, name, t.id, patch);
        return null;
      }
      if (name === "storage_usage") return usage(p.p_owner);
      throw Error(`UNKNOWN_OPERATION: ${name}`);
    }),
  );

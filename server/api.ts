import { defaultQuestions } from "../src/data/default-questions";
import { DEMO_FOREST_IMAGE } from "../src/domain/demo-assets";
import express from "express";
import { createRateLimiter, securityHeaders } from "./security";
import cors from "cors";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { admin, checked } from "./client";
import {
  assetIds,
  playableErrors,
  studioSpecSchema,
  templateRegistry,
  mcqSchema,
} from "../src/domain/studio-spec";
import { deckSlides } from "./pptx";
import { authRouter, requestToken } from "./auth";
import { fileRouter } from "./storage";
import { sql } from "./database";

const app = express();
app.disable("x-powered-by");
// Set only to the known hop count of your reverse proxy, never blindly trust X-Forwarded-For.
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isInteger(proxyHops) && proxyHops > 0 && proxyHops <= 5)
  app.set("trust proxy", proxyHops);
app.use(securityHeaders);
app.use("/api", createRateLimiter(300, 60000));
app.use(
  cors({
    credentials: true,
    origin: [
      process.env.FRONTEND_URL || "http://127.0.0.1:5173",
      "http://127.0.0.1:4173",
    ],
  }),
);
const jsonBody = express.json({ limit: "1mb", inflate: false });
app.use((req, res, next) =>
  req.path === "/api/files/upload" ? next() : jsonBody(req, res, next),
);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    origin &&
    ![
      process.env.FRONTEND_URL || "http://127.0.0.1:5173",
      "http://127.0.0.1:4173",
    ].includes(origin)
  )
    return res.status(403).json({ error: "ORIGIN_FORBIDDEN" });
  next();
});
app.use("/api/auth", authRouter);
app.use("/api/files", fileRouter);
app.get("/api/health", async (_req, res) => {
  await sql("SELECT 1");
  res.json({ ok: true, database: "mariadb" });
});
app.get("/api/catalog", async (_req, res) =>
  res.json({
    subjects: await sql("SELECT id,name FROM subjects WHERE enabled=TRUE"),
    templates: await sql("SELECT type FROM templates WHERE enabled=TRUE"),
  }),
);
app.post("/api/internal/worker", async (req, res) => {
  const secret = process.env.INTERNAL_WORKER_SECRET,
    provided = req.headers.authorization?.replace(/^Bearer /, "") || "";
  if (
    !secret ||
    Buffer.byteLength(secret) !== Buffer.byteLength(provided) ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(provided))
  )
    return res.status(401).json({ error: "Unauthorized" });
  const { processJob } = await import("./worker");
  await processJob();
  res.json({ ok: true });
});
app.post("/api/internal/cleanup", async (req, res) => {
  const secret = process.env.INTERNAL_WORKER_SECRET,
    provided = req.headers.authorization?.replace(/^Bearer /, "") || "";
  if (
    !secret ||
    Buffer.byteLength(secret) !== Buffer.byteLength(provided) ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(provided))
  )
    return res.status(401).json({ error: "Unauthorized" });
  const { cleanup } = await import("./cleanup");
  res.json(await cleanup());
});
app.get("/api/public/shares/:id", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const share = checked(
    await admin
      .from("share_links")
      .select("*")
      .eq("id", id)
      .is("revoked_at", null)
      .maybeSingle(),
  );
  if (!share)
    return res
      .status(404)
      .json({ error: "Liên kết không tồn tại hoặc đã thu hồi." });
  const profile = checked(
    await admin
      .from("profiles")
      .select("status")
      .eq("id", share.owner_id)
      .single(),
  );
  if (profile.status !== "active")
    return res.status(404).json({ error: "Trò chơi không còn công khai." });
  const spec = studioSpecSchema.parse(share.snapshot),
    assets = [];
  for (const assetId of assetIds(spec)) {
    const asset = checked(
      await admin
        .from("assets")
        .select("*")
        .eq("id", assetId)
        .eq("status", "ready")
        .single(),
    );
    if (
      asset.owner_id !== share.owner_id &&
      !(asset.owner_id === null && asset.approved)
    )
      return res.status(404).json({ error: "Tài nguyên không khả dụng." });
    assets.push({
      alt_text: asset.alt_text,
      revision: asset.revision,
      id: asset.id,
      name: asset.name,
      status: "ready",
      owner_id: null,
      url: checked(
        await admin.storage.from("media").createSignedUrl(asset.path, 60),
      ).signedUrl,
    });
  }
  res.json({ spec, assets });
});
app.use("/api", async (req, res, next) => {
  try {
    const token = requestToken(req);
    if (!token) return res.status(401).json({ error: "Vui lòng đăng nhập." });
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user?.email_confirmed_at)
      return res
        .status(401)
        .json({ error: "Phiên không hợp lệ hoặc email chưa xác minh." });
    const profile = checked(
      await admin.from("profiles").select("*").eq("id", data.user.id).single(),
    );
    if (profile.status !== "active" && req.path !== "/me")
      return res.status(403).json({ error: "Tài khoản chưa hoạt động." });
    res.locals.profile = profile;
    next();
  } catch (error) {
    next(error);
  }
});
const accountWrites = createRateLimiter(80, 60000, (req) =>
  String(req.res?.locals.profile?.id || req.ip),
);
app.use("/api", (req, res, next) =>
  ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)
    ? accountWrites(req, res, next)
    : next(),
);
const owner = (res: express.Response) => res.locals.profile.id as string;
app.get("/api/me", (_req, res) => res.json(res.locals.profile));
app.get("/api/dashboard", async (_req, res) => {
  const id = owner(res);
  const [games, jobs, sessions] = await Promise.all([
    admin
      .from("games")
      .select("*")
      .eq("owner_id", id)
      .order("updated_at", { ascending: false }),
    admin
      .from("jobs")
      .select("id,kind,status,error,result,created_at,payload", {
        count: "exact",
      })
      .eq("owner_id", id)
      .eq("kind", "export")
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("play_sessions")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", id),
  ]);
  checked(sessions);
  res.json({
    games: checked(games),
    exports: checked(jobs).map(({ payload, ...job }: Record<string, any>) => ({
      ...job,
      gameTitle:
        payload?.spec?.metadata?.title?.trim() || "Trò chơi chưa đặt tên",
    })),
    exportsCount: jobs.count || 0,
    plays: sessions.count || 0,
  });
});
app.get("/api/games/:id", async (req, res) => {
  const game = checked(
    await admin
      .from("games")
      .select("*")
      .eq("id", req.params.id)
      .eq("owner_id", owner(res))
      .maybeSingle(),
  );
  if (!game) return res.status(404).json({ error: "Không tìm thấy trò chơi." });
  res.json(game);
});
app.delete("/api/games/:id", async (req, res) => {
  checked(
    await admin.rpc("archive_game", {
      p_owner: owner(res),
      p_id: z.string().uuid().parse(req.params.id),
      p_revision: z.number().int().positive().parse(req.body.revision),
    }),
  );
  res.json({ ok: true });
});
app.put("/api/games/:id", async (req, res) => {
  const spec = studioSpecSchema.parse(req.body.spec);
  if (spec.id !== req.params.id)
    return res.status(400).json({ error: "ID không khớp." });
  const revision = z.number().int().min(0).parse(req.body.revision);
  const { data, error } = await admin.rpc("save_game", {
    p_owner: owner(res),
    p_spec: spec,
    p_revision: revision,
    p_assets: assetIds(spec),
  });
  if (error?.message.includes("REVISION_CONFLICT"))
    return res.status(409).json({
      error:
        "Bài đã được sửa ở nơi khác. Hãy tải bản mới hoặc lưu thành bản sao.",
    });
  res.json(checked({ data, error }));
});
app.get("/api/assets", async (_req, res) => {
  const rows = checked(
    await admin
      .from("assets")
      .select("*")
      .or(`owner_id.eq.${owner(res)},and(owner_id.is.null,approved.eq.true)`)
      .in("status", ["ready", "pending", "processing"]),
  );
  const assets = await Promise.all(
    rows.map(async (a: Record<string, any>) => ({
      ...a,
      url:
        a.status === "ready" && a.path
          ? checked(
              await admin.storage.from("media").createSignedUrl(a.path, 300),
            ).signedUrl
          : undefined,
      thumbnailUrl: a.thumbnail_path
        ? checked(
            await admin.storage
              .from("media")
              .createSignedUrl(a.thumbnail_path, 300),
          ).signedUrl
        : undefined,
    })),
  );
  res.json(assets);
});
app.post("/api/uploads/request", async (req, res) => {
  const input = z
    .object({
      name: z.string().min(1).max(180),
      bytes: z.number().int().positive().max(5242880),
      mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
      key: z.string().uuid(),
    })
    .parse(req.body);
  const id = crypto.randomUUID();
  const payload = {
    assetId: id,
    path: `${owner(res)}/${id}`,
    name: input.name,
    mime: input.mime,
    bytes: input.bytes,
    ready: false,
  };
  const job = checked(
    await admin.rpc("reserve_job", {
      p_owner: owner(res),
      p_kind: "upload",
      p_key: input.key,
      p_payload: payload,
      p_bytes: input.bytes,
    }),
  );
  if (job.status !== "queued" || job.payload.ready)
    return res.json({
      jobId: job.id,
      assetId: job.payload.assetId,
      status: job.status,
    });
  const signed = checked(
    await admin.storage
      .from("uploads")
      .createSignedUploadUrl(job.payload.path, {
        bytes: job.payload.bytes,
        mime: job.payload.mime,
        jobId: job.id,
        ownerId: owner(res),
      }),
  );
  res.json({
    jobId: job.id,
    assetId: job.payload.assetId,
    path: signed.path,
    token: signed.token,
  });
});
app.post("/api/assets/:id/crop", async (req, res) => {
  const input = z
    .object({
      key: z.string().uuid(),
      crop: z.object({
        fit: z.enum(["cover", "contain"]),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        zoom: z.number().min(1).max(3),
        opacity: z.number().min(0).max(1),
        aspect: z.enum(["16:9", "4:5", "1:1"]),
      }),
    })
    .parse(req.body);
  const source = checked(
    await admin
      .from("assets")
      .select("*")
      .eq("id", req.params.id)
      .eq("status", "ready")
      .single(),
  );
  if (
    source.owner_id !== owner(res) &&
    !(source.owner_id === null && source.approved)
  )
    return res.status(403).json({ error: "ASSET_FORBIDDEN" });
  const id = crypto.randomUUID(),
    payload = {
      assetId: id,
      sourceAssetId: source.id,
      path: `${owner(res)}/${id}`,
      name: `${source.name} (cắt)`.slice(0, 180),
      mime: source.mime,
      ready: true,
      crop: input.crop,
    };
  res.json(
    checked(
      await admin.rpc("reserve_job", {
        p_owner: owner(res),
        p_kind: "upload",
        p_key: input.key,
        p_payload: payload,
        p_bytes: Math.min(5242880, Math.max(source.bytes, 512000)),
      }),
    ),
  );
});
app.patch("/api/assets/:id", async (req, res) => {
  const input = z
    .object({
      altText: z.string().max(300),
      revision: z.number().int().positive(),
    })
    .strict()
    .parse(req.body);
  const asset = checked(
    await admin
      .from("assets")
      .update({ alt_text: input.altText, revision: input.revision + 1 })
      .eq("id", req.params.id)
      .eq("owner_id", owner(res))
      .eq("status", "ready")
      .eq("revision", input.revision)
      .select()
      .maybeSingle(),
  );
  if (!asset)
    return res.status(409).json({
      error: "Ảnh đã thay đổi hoặc không thuộc quyền chỉnh sửa của bạn.",
    });
  res.json(asset);
});
app.post("/api/uploads/:id/complete", async (req, res) => {
  const job = checked(
    await admin
      .from("jobs")
      .select("*")
      .eq("id", req.params.id)
      .eq("owner_id", owner(res))
      .eq("kind", "upload")
      .single(),
  );
  if (!job.payload.ready && job.status === "queued")
    checked(
      await admin
        .from("jobs")
        .update({ payload: { ...job.payload, ready: true } })
        .eq("id", job.id)
        .eq("status", "queued"),
    );
  res.json({ id: job.id, status: job.status });
});
app.delete("/api/assets/:id", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const result = await admin.rpc("delete_asset", {
    p_owner: owner(res),
    p_asset: id,
  });
  if (result.error?.message.includes("ASSET_IN_USE"))
    return res.status(409).json({
      error:
        "Ảnh đang được sử dụng. Hãy thay ảnh trong trò chơi trước khi xóa.",
    });
  checked(result);
  res.json({ ok: true });
});
app.get("/api/jobs/:id", async (req, res) => {
  const job = checked(
    await admin
      .from("jobs")
      .select("id,kind,status,error,result")
      .eq("id", req.params.id)
      .eq("owner_id", owner(res))
      .single(),
  );
  res.json(job);
});
app.get("/api/exports/:id/download", async (req, res) => {
  const job = checked(
    await admin
      .from("jobs")
      .select("*")
      .eq("id", req.params.id)
      .eq("owner_id", owner(res))
      .eq("kind", "export")
      .eq("status", "completed")
      .single(),
  );
  if (!job.result?.path)
    return res.status(410).json({
      error: "File đã hết hạn lưu trữ. Hãy xuất lại từ trò chơi gốc.",
    });
  res.json(
    checked(
      await admin.storage
        .from("media")
        .createSignedUrl(job.result.path, 60, { download: true }),
    ),
  );
});
app.post("/api/sessions", async (req, res) => {
  const input = z
    .object({
      id: z.string().uuid(),
      gameId: z.string().uuid(),
      result: z.object({
        scores: z.array(z.number().int().nonnegative()).max(50),
      }),
    })
    .parse(req.body);
  const game = checked(
    await admin
      .from("games")
      .select("id")
      .eq("id", input.gameId)
      .eq("owner_id", owner(res))
      .single(),
  );
  checked(
    await admin.from("play_sessions").upsert(
      {
        id: input.id,
        owner_id: owner(res),
        game_id: game.id,
        result: input.result,
      },
      { onConflict: "id", ignoreDuplicates: true },
    ),
  );
  res.json({ ok: true });
});
app.post("/api/exports", async (req, res) => {
  const spec = studioSpecSchema.parse(req.body.spec);
  const errors = playableErrors(spec);
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });
  if (!templateRegistry[spec.kind].released)
    return res.status(409).json({ error: "Mẫu chưa phát hành." });
  if (deckSlides(spec).length > 60)
    return res.status(400).json({ error: "Vượt giới hạn 60 slide." });
  for (const id of assetIds(spec)) {
    if (req.body.demo === true && id === DEMO_FOREST_IMAGE) continue;
    const asset = checked(
      await admin
        .from("assets")
        .select("*")
        .eq("id", id)
        .eq("status", "ready")
        .single(),
    );
    if (
      asset.owner_id !== owner(res) &&
      !(asset.owner_id === null && asset.approved)
    )
      return res.status(403).json({ error: "Ảnh không thuộc quyền sử dụng." });
  }
  const key = z.string().uuid().parse(req.body.key);
  res.json(
    checked(
      await admin.rpc("reserve_job", {
        p_owner: owner(res),
        p_kind: "export",
        p_key: key,
        p_payload: {
          spec,
          assetIds: assetIds(spec).filter(
            (id) => !(req.body.demo === true && id === DEMO_FOREST_IMAGE),
          ),
          demo: req.body.demo === true,
        },
      }),
    ),
  );
});
app.get("/api/admin/accounts", async (_req, res) => {
  const p = res.locals.profile;
  if (
    p.role !== "super_admin" &&
    !(p.role === "admin" && p.permissions.includes("accounts"))
  )
    return res.status(403).json({ error: "FORBIDDEN" });
  res.json(
    checked(
      await admin
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false }),
    ),
  );
});
app.patch("/api/admin/accounts/:id", async (req, res) => {
  const patch = z
    .object({
      role: z.enum(["teacher", "admin", "super_admin"]).optional(),
      status: z.enum(["active", "pending", "suspended"]).optional(),
      permissions: z
        .array(
          z.enum([
            "accounts",
            "assets",
            "templates",
            "subjects",
            "moderation",
            "audit",
            "operations",
          ]),
        )
        .optional(),
      storage_limit: z.number().int().nonnegative().max(10737418240).optional(),
      upload_limit: z.number().int().min(1).max(20).optional(),
      daily_export_limit: z.number().int().min(0).max(1000).optional(),
      concurrent_export_limit: z.number().int().min(1).max(10).optional(),
    })
    .strict()
    .parse(req.body);
  checked(
    await admin.rpc("manage_account", {
      p_actor: owner(res),
      p_target: z.string().uuid().parse(req.params.id),
      p_patch: patch,
    }),
  );
  res.json({ ok: true });
});
app.post("/api/games/:id/submit", async (req, res) => {
  const revision = z.number().int().positive().parse(req.body.revision),
    game = checked(
      await admin
        .from("games")
        .select("*")
        .eq("id", req.params.id)
        .eq("owner_id", owner(res))
        .single(),
    );
  const errors = playableErrors(game.spec);
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });
  res.json(
    checked(
      await admin.rpc("submit_game", {
        p_owner: owner(res),
        p_id: game.id,
        p_revision: revision,
      }),
    ),
  );
});
app.post("/api/games/:id/revoke", async (req, res) => {
  checked(
    await admin.rpc("revoke_share", {
      p_owner: owner(res),
      p_game: z.string().uuid().parse(req.params.id),
      p_revision: z.number().int().positive().parse(req.body.revision),
    }),
  );
  res.json({ ok: true });
});
app.get("/api/games/:id/share", async (req, res) => {
  res.json(
    checked(
      await admin
        .from("share_links")
        .select("id,created_at")
        .eq("game_id", req.params.id)
        .eq("owner_id", owner(res))
        .is("revoked_at", null),
    ),
  );
});
function permission(res: express.Response, key: string) {
  const p = res.locals.profile;
  if (
    p.role !== "super_admin" &&
    !(p.role === "admin" && p.permissions.includes(key))
  )
    throw new Error("FORBIDDEN");
}
app.get("/api/admin/:section", async (req, res) => {
  const section = z
    .enum([
      "subjects",
      "templates",
      "assets",
      "moderation",
      "audit",
      "operations",
    ])
    .parse(req.params.section);
  permission(res, section);
  const table = {
    subjects: "subjects",
    templates: "template_versions",
    assets: "assets",
    moderation: "games",
    audit: "audit_log",
    operations: "app_settings",
  }[section];
  let query = admin
    .from(table)
    .select(section === "templates" ? "*,templates(name,enabled)" : "*")
    .limit(200);
  if (section === "moderation") query = query.eq("status", "pending");
  res.json(checked(await query));
});
app.put("/api/admin/templates/:id", async (req, res) => {
  permission(res, "templates");
  const type = z
      .enum([
        "journey",
        "picture_reveal",
        "word_wheel",
        "clever_frog",
        "forest_rescue",
        "boat_rescue",
        "football",
      ])
      .parse(req.params.id),
    enabled = z.boolean().parse(req.body.enabled);
  checked(await admin.from("templates").update({ enabled }).eq("type", type));
  checked(
    await admin.from("audit_log").insert({
      actor_id: owner(res),
      action: "toggle_template",
      target_id: type,
      details: { enabled },
    }),
  );
  res.json({ ok: true });
});
app.post("/api/admin/moderation/:id", async (req, res) => {
  permission(res, "moderation");
  const input = z
    .object({ revision: z.number().int().positive(), approve: z.boolean() })
    .parse(req.body);
  const game = checked(
    await admin.from("games").select("spec").eq("id", req.params.id).single(),
  );
  if (input.approve && playableErrors(game.spec).length)
    return res.status(400).json({ error: "Bài chưa hợp lệ." });
  res.json({
    shareId: checked(
      await admin.rpc("moderate_game", {
        p_actor: owner(res),
        p_id: z.string().uuid().parse(req.params.id),
        p_revision: input.revision,
        p_approve: input.approve,
      }),
    ),
  });
});
app.put("/api/admin/subjects/:id", async (req, res) => {
  permission(res, "subjects");
  const input = z
      .object({ name: z.string().trim().min(1).max(80), enabled: z.boolean() })
      .strict()
      .parse(req.body),
    id = z
      .string()
      .regex(/^[a-z][a-z0-9_]{0,39}$/)
      .parse(req.params.id);
  checked(await admin.from("subjects").upsert({ id, ...input }));
  checked(
    await admin.from("audit_log").insert({
      actor_id: owner(res),
      action: "update_subject",
      target_id: id,
      details: input,
    }),
  );
  res.json({ ok: true });
});
app.put("/api/admin/operations/approval", async (req, res) => {
  permission(res, "operations");
  const value = z.boolean().parse(req.body.value);
  checked(
    await admin
      .from("app_settings")
      .upsert({ key: "require_account_approval", value }),
  );
  checked(
    await admin.from("audit_log").insert({
      actor_id: owner(res),
      action: "configure_approval",
      details: { value },
    }),
  );
  res.json({ ok: true });
});
app.post("/api/admin/assets/:id/publish", async (req, res) => {
  permission(res, "assets");
  const input = z
    .object({
      source: z.string().trim().min(3).max(500),
      license: z.string().trim().min(3).max(500),
    })
    .strict()
    .parse(req.body);
  const asset = checked(
    await admin
      .from("assets")
      .select("*")
      .eq("id", req.params.id)
      .eq("owner_id", owner(res))
      .eq("status", "ready")
      .single(),
  );
  // A default copy has a fresh ID; never turn another teacher's private record public.
  const copyId = crypto.randomUUID(),
    path = `defaults/${copyId}.webp`,
    thumb = `defaults/${copyId}-thumb.webp`;
  checked(await admin.storage.from("media").copy(asset.path, path));
  if (asset.thumbnail_path)
    checked(
      await admin.storage.from("media").copy(asset.thumbnail_path, thumb),
    );
  checked(
    await admin.from("assets").insert({
      id: copyId,
      owner_id: null,
      name: asset.name,
      path,
      thumbnail_path: asset.thumbnail_path ? thumb : null,
      mime: asset.mime,
      alt_text: asset.alt_text,
      bytes: asset.bytes,
      width: asset.width,
      height: asset.height,
      status: "ready",
      approved: true,
      ...input,
    }),
  );
  checked(
    await admin.from("audit_log").insert({
      actor_id: owner(res),
      action: "publish_default_asset",
      target_id: copyId,
      details: input,
    }),
  );
  res.json({ id: copyId });
});
app.get("/api/questions", async (_req, res) =>
  res.json([
    ...defaultQuestions,
    ...checked(
      await admin
        .from("questions")
        .select("*")
        .eq("owner_id", owner(res))
        .order("created_at", { ascending: false }),
    ),
  ]),
);
app.put("/api/questions/:id", async (req, res) => {
  if (defaultQuestions.some((q) => q.id === req.params.id))
    return res.status(403).json({
      error: "Câu hỏi mặc định chỉ được đọc. Hãy lưu bản riêng để chỉnh sửa.",
    });
  const id = z.string().uuid().parse(req.params.id),
    body = mcqSchema.parse(req.body.body),
    revision = z.number().int().nonnegative().parse(req.body.revision);
  if (body.id !== id) return res.status(400).json({ error: "ID không khớp." });
  if (body.imageId) {
    const asset = checked(
      await admin
        .from("assets")
        .select("*")
        .eq("id", body.imageId)
        .eq("status", "ready")
        .single(),
    );
    if (
      asset.owner_id !== owner(res) &&
      !(asset.owner_id === null && asset.approved)
    )
      return res.status(403).json({ error: "FORBIDDEN" });
  }
  if (!revision) {
    res.json(
      checked(
        await admin
          .from("questions")
          .insert({ id, owner_id: owner(res), body })
          .select()
          .single(),
      ),
    );
    return;
  }
  const row = checked(
    await admin
      .from("questions")
      .update({ body, revision: revision + 1 })
      .eq("id", id)
      .eq("owner_id", owner(res))
      .eq("revision", revision)
      .select()
      .maybeSingle(),
  );
  if (!row)
    return res
      .status(409)
      .json({ error: "Câu hỏi đã thay đổi. Tải lại trước khi sửa." });
  res.json(row);
});
app.delete("/api/questions/:id", async (req, res) => {
  if (defaultQuestions.some((q) => q.id === req.params.id))
    return res.status(403).json({
      error: "Câu hỏi mặc định chỉ được đọc. Hãy lưu bản riêng để chỉnh sửa.",
    });
  const revision = z.coerce.number().int().positive().parse(req.query.revision);
  const rows = checked(
    await admin
      .from("questions")
      .delete()
      .eq("id", req.params.id)
      .eq("owner_id", owner(res))
      .eq("revision", revision)
      .select("id"),
  );
  if (!rows.length)
    return res.status(409).json({ error: "Câu hỏi đã thay đổi." });
  res.json({ ok: true });
});
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const message = error instanceof Error ? error.message : "Có lỗi xảy ra.";
    const httpStatus = Number((error as { status?: number })?.status);
    const known = /^[A-Z][A-Z0-9_]{2,80}$/.test(message);
    console.error(
      "API request failed:",
      known ? message : (error as { code?: string })?.code || "REQUEST_ERROR",
    );
    res
      .status(
        [400, 413, 415].includes(httpStatus)
          ? httpStatus
          : error instanceof z.ZodError
            ? 400
            : /FORBIDDEN|SUPER_ADMIN_REQUIRED/.test(message)
              ? 403
              : /REVISION_CONFLICT|ASSET_IN_USE/.test(message)
                ? 409
                : /QUOTA|CONCURRENCY/.test(message)
                  ? 429
                  : 422,
      )
      .json({
        error:
          httpStatus === 413
            ? "Dữ liệu gửi lên vượt giới hạn."
            : httpStatus === 415
              ? "Định dạng dữ liệu không được hỗ trợ."
              : error instanceof z.ZodError || httpStatus === 400
                ? "Thông tin gửi lên không hợp lệ."
                : known
                  ? message
                  : "Không thể thực hiện yêu cầu. Vui lòng thử lại sau.",
      });
  },
);
export default app;
if (!process.env.VERCEL)
  app.listen(Number(process.env.API_PORT || 8787), "127.0.0.1", () =>
    console.log("EduGame API: http://127.0.0.1:8787"),
  );

import "dotenv/config";
import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { resolve, sep, dirname } from "node:path";
import {
  mkdir,
  readFile,
  writeFile,
  rm,
  copyFile,
  readdir,
  stat,
} from "node:fs/promises";
import { result, sql } from "./database";
import { createRateLimiter } from "./security";
import { validateImage, MAX_IMAGE_BYTES } from "./image-validation";
import { z } from "zod";

export const storageRoot = resolve(process.env.STORAGE_ROOT || "data/storage");
const secret = () => {
  if (!process.env.STORAGE_SIGNING_SECRET)
    throw Error("Thiếu STORAGE_SIGNING_SECRET");
  return process.env.STORAGE_SIGNING_SECRET;
};
const base = () => process.env.API_PUBLIC_URL || "http://127.0.0.1:8787";
function file(bucket: string, path: string) {
  if (
    !/^[a-z0-9_-]+$/.test(bucket) ||
    !path ||
    path.includes("\\") ||
    /[:\x00-\x1f\x7f]/.test(path) ||
    path.length > 512 ||
    path.split("/").some((s) => /[ .]$/.test(s)) ||
    path.split("/").some((s) => s === ".." || s === "." || !s)
  )
    throw Error("INVALID_STORAGE_PATH");
  const root = resolve(storageRoot, bucket),
    f = resolve(root, path);
  if (!f.startsWith(root + sep)) throw Error("INVALID_STORAGE_PATH");
  return f;
}
type Capability = {
  bucket: string;
  path: string;
  purpose: "read" | "upload";
  expires: number;
  download?: boolean;
  bytes?: number;
  mime?: string;
  jobId?: string;
  ownerId?: string;
};
function sign(value: Capability) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", secret()).update(payload).digest("base64url")
  );
}
function verify(token: string, purpose: string): Capability {
  if (token.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
    throw Error("INVALID_TOKEN");
  const [data, signature] = token.split(".");
  if (!data || !signature) throw Error("INVALID_TOKEN");
  const expected = createHmac("sha256", secret()).update(data).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw Error("INVALID_TOKEN");
  const cap = z
    .object({
      bucket: z.string().min(1).max(40),
      path: z.string().min(1).max(512),
      purpose: z.enum(["read", "upload"]),
      expires: z.number().finite().positive(),
      download: z.boolean().optional(),
      bytes: z.number().int().positive().max(MAX_IMAGE_BYTES).optional(),
      mime: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
      jobId: z.string().uuid().optional(),
      ownerId: z.string().uuid().optional(),
    })
    .strict()
    .parse(JSON.parse(Buffer.from(data, "base64url").toString()));
  if (cap.purpose !== purpose || cap.expires < Date.now())
    throw Error("TOKEN_EXPIRED");
  file(cap.bucket, cap.path);
  return cap;
}
export const storage = {
  from(bucket: string) {
    return {
      download: (path: string) =>
        result(
          async () =>
            new Blob([new Uint8Array(await readFile(file(bucket, path)))]),
        ),
      upload: (
        path: string,
        data: Buffer | Uint8Array,
        options: { upsert?: boolean; contentType?: string } = {},
      ) =>
        result(async () => {
          const f = file(bucket, path);
          await mkdir(dirname(f), { recursive: true });
          await writeFile(f, data, { flag: options.upsert ? "w" : "wx" });
          return { path };
        }),
      remove: (paths: string[]) =>
        result(async () => {
          for (const p of paths) await rm(file(bucket, p), { force: true });
          return [];
        }),
      copy: (source: string, target: string) =>
        result(async () => {
          const f = file(bucket, target);
          await mkdir(dirname(f), { recursive: true });
          await copyFile(file(bucket, source), f);
          return { path: target };
        }),
      createSignedUrl: (
        path: string,
        seconds: number,
        options: { download?: boolean } = {},
      ) =>
        result(async () => {
          file(bucket, path);
          return {
            signedUrl: `${base()}/api/files/read?token=${sign({ bucket, path, purpose: "read", expires: Date.now() + seconds * 1000, download: !!options.download })}`,
          };
        }),
      createSignedUploadUrl: (
        path: string,
        options: {
          bytes?: number;
          mime?: string;
          jobId?: string;
          ownerId?: string;
          upsert?: boolean;
        } = {},
      ) =>
        result(async () => {
          file(bucket, path);
          if (bucket !== "uploads") throw Error("INVALID_BUCKET");
          const binding = z
            .object({
              bytes: z.number().int().positive().max(MAX_IMAGE_BYTES),
              mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
              jobId: z.string().uuid(),
              ownerId: z.string().uuid(),
            })
            .parse(options);
          return {
            path,
            token: sign({
              bucket,
              path,
              purpose: "upload",
              ...binding,
              expires: Date.now() + 300000,
            }),
          };
        }),
      list: (
        prefix = "",
        options: { offset?: number; limit?: number; sortBy?: unknown } = {},
      ) =>
        result(async () => {
          const dir = prefix
            ? file(bucket, prefix)
            : resolve(storageRoot, bucket);
          const entries = await readdir(dir, { withFileTypes: true }).catch(
            () => [],
          );
          return Promise.all(
            entries
              .sort((a, b) => a.name.localeCompare(b.name))
              .slice(
                options.offset || 0,
                (options.offset || 0) + (options.limit || 100),
              )
              .map(async (e) => ({
                name: e.name,
                id: e.isDirectory() ? null : e.name,
                metadata: e.isDirectory()
                  ? null
                  : { size: (await stat(resolve(dir, e.name))).size },
              })),
          );
        }),
    };
  },
  createBucket: (bucket: string, _options: unknown = {}) =>
    result(async () => {
      if (!/^[a-z0-9_-]+$/.test(bucket)) throw Error("INVALID_BUCKET");
      await mkdir(resolve(storageRoot, bucket), { recursive: true });
      return { name: bucket };
    }),
  deleteBucket: (bucket: string) =>
    result(async () => {
      if (!/^[a-z0-9_-]+$/.test(bucket)) throw Error("INVALID_BUCKET");
      await rm(resolve(storageRoot, bucket));
      return {};
    }),
};
export const fileRouter = express.Router();
fileRouter.put(
  "/upload",
  createRateLimiter(30, 60000),
  async (req, res, next) => {
    try {
      const cap = verify(String(req.query.token || ""), "upload");
      if (
        cap.bucket !== "uploads" ||
        !cap.bytes ||
        !cap.mime ||
        !cap.jobId ||
        !cap.ownerId ||
        cap.path.split("/").length !== 2 ||
        cap.path.split("/")[0] !== cap.ownerId
      )
        throw Error("INVALID_TOKEN");
      const job = (
        await sql(
          "SELECT j.status,j.payload,p.status AS account_status FROM jobs j JOIN profiles p ON p.id=j.owner_id WHERE j.id=? AND j.owner_id=? AND j.kind='upload'",
          [cap.jobId, cap.ownerId],
        )
      )[0];
      if (
        !job ||
        job.status !== "queued" ||
        job.payload.ready ||
        job.account_status !== "active" ||
        job.payload.path !== cap.path ||
        job.payload.bytes !== cap.bytes ||
        job.payload.mime !== cap.mime
      )
        throw Error("INVALID_TOKEN");
      if (
        req.headers["content-encoding"] &&
        req.headers["content-encoding"] !== "identity"
      )
        return res
          .status(415)
          .json({ error: "Không nhận dữ liệu upload nén." });
      if (
        req.headers["content-length"] !== undefined &&
        Number(req.headers["content-length"]) !== cap.bytes
      )
        return res.status(400).json({ error: "Dung lượng upload không khớp." });
      if (
        req.get("content-type")?.split(";")[0].trim().toLowerCase() !== cap.mime
      )
        return res.status(415).json({ error: "Loại ảnh upload không khớp." });
      res.locals.uploadCapability = cap;
      next();
    } catch {
      res
        .status(403)
        .json({ error: "Vé upload không hợp lệ, đã dùng hoặc hết hạn." });
    }
  },
  express.raw({ type: () => true, limit: "5mb", inflate: false }),
  async (req, res) => {
    try {
      const cap = res.locals.uploadCapability as Capability;
      if (cap.bucket !== "uploads") throw Error("INVALID_BUCKET");
      await validateImage(req.body, cap.mime!, cap.bytes);
      const f = file(cap.bucket, cap.path);
      await mkdir(dirname(f), { recursive: true });
      await writeFile(f, req.body, { flag: "wx", mode: 0o600 });
      res.json({ path: cap.path });
    } catch (e) {
      res
        .status(400)
        .json({
          error:
            "Ảnh không hợp lệ, đã được tải lên hoặc không khớp yêu cầu. Chỉ nhận ảnh tĩnh PNG/JPEG/WebP, tối đa 5 MB và 24 megapixel.",
        });
    }
  },
);
fileRouter.get("/read", async (req, res) => {
  try {
    const cap = verify(String(req.query.token || ""), "read");
    if (cap.bucket !== "media") throw Error("INVALID_BUCKET");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (cap.download) res.download(file(cap.bucket, cap.path));
    else res.sendFile(file(cap.bucket, cap.path));
  } catch {
    res.status(403).json({ error: "Liên kết không hợp lệ hoặc đã hết hạn." });
  }
});

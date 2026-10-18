import { afterAll, beforeAll, it, expect, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { createRateLimiter, securityHeaders } from "../../server/security";
import { validateImage, imageMime } from "../../server/image-validation";

const db = vi.hoisted(() => ({ job: null as any }));
vi.mock("../../server/database", () => ({
  sql: vi.fn(async () => (db.job ? [db.job] : [])),
  result: async (fn: () => Promise<unknown>) => {
    try {
      return { data: await fn(), error: null };
    } catch (e) {
      return { data: null, error: e };
    }
  },
}));
let server: Server,
  base: string,
  root: string,
  storage: typeof import("../../server/storage").storage;
const previousRoot = process.env.STORAGE_ROOT,
  previousSecret = process.env.STORAGE_SIGNING_SECRET;
const owner = "11111111-1111-4111-8111-111111111111",
  jobId = "22222222-2222-4222-8222-222222222222";
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "duong-security-"));
  process.env.STORAGE_ROOT = root;
  process.env.STORAGE_SIGNING_SECRET =
    "test-only-signing-secret-not-for-production";
  const module = await import("../../server/storage");
  storage = module.storage;
  const app = express();
  app.use(securityHeaders);
  app.use("/files", module.fileRouter);
  app.get("/limit", createRateLimiter(2, 60000), (_req, res) =>
    res.json({ ok: true }),
  );
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve())),
  );
  if (!root.startsWith(join(tmpdir(), "duong-security-")))
    throw Error("Unsafe test cleanup path");
  await rm(root, { recursive: true, force: true });
  if (previousRoot === undefined) delete process.env.STORAGE_ROOT;
  else process.env.STORAGE_ROOT = previousRoot;
  if (previousSecret === undefined) delete process.env.STORAGE_SIGNING_SECRET;
  else process.env.STORAGE_SIGNING_SECRET = previousSecret;
});
async function ticket(bytes: Buffer, mime = "image/png") {
  const path = `${owner}/${crypto.randomUUID()}`;
  db.job = {
    status: "queued",
    account_status: "active",
    payload: { path, bytes: bytes.length, mime, ready: false },
  };
  const signed = await storage
    .from("uploads")
    .createSignedUploadUrl(path, {
      bytes: bytes.length,
      mime,
      jobId,
      ownerId: owner,
    });
  if (signed.error) throw signed.error;
  return `${base}/files/upload?token=${encodeURIComponent(signed.data!.token)}`;
}
it("rejects unsigned upload before parsing any file", async () => {
  const response = await fetch(`${base}/files/upload?token=invalid`, {
    method: "PUT",
    body: "not an image",
    headers: { "Content-Type": "application/json" },
  });
  expect(response.status).toBe(403);
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
});
it("accepts a bound valid image once, rejects replay and wrong size", async () => {
  const data = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#abcdef" },
  })
    .png()
    .toBuffer();
  const url = await ticket(data);
  expect(
    (
      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: new Uint8Array(data.subarray(0, 10)),
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: new Uint8Array(data),
      })
    ).status,
  ).toBe(415);
  expect(
    (
      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: new Uint8Array(data),
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: new Uint8Array(data),
      })
    ).status,
  ).toBe(400);
});
it("blocks spoofed images and disabled accounts", async () => {
  const data = Buffer.from('<svg onload="alert(1)"></svg>');
  const url = await ticket(data);
  expect(
    (
      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: new Uint8Array(data),
      })
    ).status,
  ).toBe(400);
  db.job.account_status = "suspended";
  expect(
    (
      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: new Uint8Array(data),
      })
    ).status,
  ).toBe(403);
});
it("does not allow raw uploads to be read using signed read links", async () => {
  const signed = await storage
    .from("uploads")
    .createSignedUrl(`${owner}/raw`, 300);
  const token = new URL(signed.data!.signedUrl).searchParams.get("token");
  expect((await fetch(`${base}/files/read?token=${token}`)).status).toBe(403);
});
it("rejects traversal, NTFS streams and control characters", async () => {
  for (const name of [
    "../escape",
    "a/../../escape",
    "a/file:payload",
    "a/evil\u0000.png",
    "a/evil.",
  ]) {
    const result = await storage.from("media").createSignedUrl(name, 300);
    expect(result.error).toBeTruthy();
  }
});
it("rate limits by real socket IP, not spoofed forwarding headers", async () => {
  for (let i = 0; i < 2; i++)
    expect(
      (
        await fetch(`${base}/limit`, {
          headers: { "X-Forwarded-For": `192.0.2.${i}` },
        })
      ).status,
    ).toBe(200);
  const blocked = await fetch(`${base}/limit`, {
    headers: { "X-Forwarded-For": "192.0.2.99" },
  });
  expect(blocked.status).toBe(429);
  expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
});
it("rejects mismatched MIME, invalid bytes and excessive pixel counts", async () => {
  const image = await sharp({
    create: { width: 4, height: 4, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  await expect(validateImage(image, "image/jpeg")).rejects.toThrow("MIME");
  await expect(validateImage(Buffer.alloc(0), "image/png")).rejects.toThrow();
  await expect(
    validateImage(Buffer.alloc(5242881), "image/png"),
  ).rejects.toThrow();
  const huge = await sharp({
    create: { width: 6000, height: 5000, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  await expect(validateImage(huge, "image/png")).rejects.toThrow();
});
it('rejects APNG animation chunks even when a decoder sees one frame',()=>{
 const animation=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from([0,0,0,8]),Buffer.from('acTL'),Buffer.alloc(12)]);
 expect(()=>imageMime(animation)).toThrow('ảnh tĩnh');
});

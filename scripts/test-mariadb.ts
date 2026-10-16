import { request } from "@playwright/test";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { pool, sql } from "../server/database";
import { createStudioGame } from "../src/domain/studio-spec";
import { readFile } from "node:fs/promises";
import { storage } from "../server/storage";

const base = "http://127.0.0.1:8787",
  password = randomUUID() + "Aa1!",
  ids: string[] = [];
const a = await request.newContext({ baseURL: base }),
  b = await request.newContext({ baseURL: base });
async function body(response: Awaited<ReturnType<typeof a.get>>, status = 200) {
  assert.equal(response.status(), status, await response.text());
  return response.json();
}
async function signup(context: typeof a) {
  const email = `migration-${randomUUID()}@example.test`;
  await body(
    await context.post("/api/auth/signup", {
      data: { email, password, display_name: "Kiểm thử MariaDB" },
    }),
  );
  const u = (await sql("SELECT id FROM users WHERE email=?", [email]))[0];
  ids.push(u.id);
  await body(
    await context.post("/api/auth/login", { data: { email, password } }),
    401,
  );
  const list = await (
    await fetch("http://127.0.0.1:8025/api/v1/messages")
  ).json();
  const item = list.messages.find((m: any) =>
    m.To.some((t: any) => t.Address === email),
  );
  assert(item, "Mail xác minh chưa đến");
  const mail = await (
    await fetch(`http://127.0.0.1:8025/api/v1/message/${item.ID}`)
  ).json();
  const url = mail.Text.match(
    /http:\/\/[^\s]+\/api\/auth\/verify\?token=[^\s]+/,
  )?.[0];
  assert(url);
  await context.get(url);
  await body(await context.get("/api/me"));
  await body(await context.get(url, { maxRedirects: 0 }), 422);
  return u.id;
}
try {
  assert.equal((await body(await a.get("/api/health"))).database, "mariadb");
  const userA = await signup(a),
    userB = await signup(b);
  const game = createStudioGame("word_wheel");
  if (game.kind !== "word_wheel") throw Error();
  game.content.phrase = "CÁNH DIỀU";
  game.content.clue = "Đồ chơi tuổi thơ";
  const saved = await body(
    await a.put(`/api/games/${game.id}`, { data: { spec: game, revision: 0 } }),
  );
  assert.equal(saved.revision, 1);
  await body(await b.get(`/api/games/${game.id}`), 404);
  await body(
    await b.put(`/api/games/${game.id}`, { data: { spec: game, revision: 1 } }),
    403,
  );
  await body(
    await a.put(`/api/games/${game.id}`, { data: { spec: game, revision: 0 } }),
    409,
  );
  await body(
    await a.patch(`/api/admin/accounts/${userA}`, {
      data: { role: "super_admin" },
    }),
    403,
  );
  const file = await readFile("public/art/forest.png");
  const upload = await body(
    await a.post("/api/uploads/request", {
      data: {
        name: "Rừng.png",
        bytes: file.length,
        mime: "image/png",
        key: randomUUID(),
      },
    }),
  );
  await body(
    await a.put(`/api/files/upload?token=${encodeURIComponent(upload.token)}`, {
      data: file,
      headers: { "Content-Type": "image/png" },
    }),
  );
  await body(await a.post(`/api/uploads/${upload.jobId}/complete`));
  async function wait(id: string) {
    for (let i = 0; i < 100; i++) {
      const job = await body(await a.get(`/api/jobs/${id}`));
      if (job.status === "failed") throw Error(job.error);
      if (job.status === "completed") return job;
      await new Promise((r) => setTimeout(r, 300));
    }
    throw Error("Job timeout");
  }
  await wait(upload.jobId);
  const assets = await body(await a.get("/api/assets"));
  assert(assets.some((x: any) => x.id === upload.assetId));
  assert(
    !(await body(await b.get("/api/assets"))).some(
      (x: any) => x.id === upload.assetId,
    ),
  );
  const image = assets.find((x: any) => x.id === upload.assetId);
  assert.equal((await a.get(image.url)).status(), 200);
  const forged = new URL(image.url);
  forged.searchParams.set(
    "token",
    forged.searchParams.get("token")!.slice(0, -4) + "xxxx",
  );
  await body(await a.get(forged.toString()), 403);
  game.media.backgroundId = upload.assetId;
  await body(
    await a.put(`/api/games/${game.id}`, { data: { spec: game, revision: 1 } }),
  );
  await body(await a.delete(`/api/assets/${upload.assetId}`), 409);
  const key = randomUUID(),
    job = await body(
      await a.post("/api/exports", { data: { spec: game, key } }),
    );
  assert.equal(
    (await body(await a.post("/api/exports", { data: { spec: game, key } })))
      .id,
    job.id,
  );
  await wait(job.id);
  await body(await b.get(`/api/jobs/${job.id}`), 422);
  const download = await body(await a.get(`/api/exports/${job.id}/download`));
  assert.equal(
    (await (await a.get(download.signedUrl)).body()).subarray(0, 2).toString(),
    "PK",
  );
  await body(
    await a.post(`/api/games/${game.id}/submit`, { data: { revision: 2 } }),
  );
  await sql("UPDATE profiles SET role='super_admin' WHERE id=?", [userB]);
  const moderation = await body(
    await b.post(`/api/admin/moderation/${game.id}`, {
      data: { revision: 3, approve: true },
    }),
  );
  await body(await b.get(`/api/public/shares/${moderation.shareId}`));
  await body(
    await a.post(`/api/games/${game.id}/revoke`, { data: { revision: 4 } }),
  );
  await body(await b.get(`/api/public/shares/${moderation.shareId}`), 404);
  await body(
    await b.patch(`/api/admin/accounts/${userA}`, {
      data: { status: "suspended" },
    }),
  );
  await body(await a.get("/api/dashboard"), 403);
  await body(
    await b.patch(`/api/admin/accounts/${userA}`, {
      data: { status: "active" },
    }),
  );
  await body(await a.post("/api/auth/logout", { data: {} }));
  await body(await a.get("/api/me"), 401);
  const account = (await sql("SELECT email FROM users WHERE id=?", [userA]))[0];
  await body(
    await a.post("/api/auth/reset", { data: { email: account.email } }),
  );
  const mailbox = await (
    await fetch("http://127.0.0.1:8025/api/v1/messages")
  ).json();
  const message = mailbox.messages.find(
    (m: any) =>
      m.To.some((t: any) => t.Address === account.email) &&
      m.Subject.includes("Đặt lại"),
  );
  assert(message);
  const resetMail = await (
    await fetch(`http://127.0.0.1:8025/api/v1/message/${message.ID}`)
  ).json();
  const resetUrl = resetMail.Text.match(
    /http:\/\/[^\s]+\/login\?mode=update&token=[^\s]+/,
  )?.[0];
  assert(resetUrl);
  const resetToken = new URL(resetUrl).searchParams.get("token"),
    newPassword = randomUUID() + "Aa1!";
  await body(
    await a.post("/api/auth/password", {
      data: { password: newPassword, token: resetToken },
    }),
  );
  await body(
    await a.post("/api/auth/password", {
      data: { password: newPassword, token: resetToken },
    }),
    422,
  );
  await body(
    await a.post("/api/auth/login", {
      data: { email: account.email, password },
    }),
    401,
  );
  await body(
    await a.post("/api/auth/login", {
      data: { email: account.email, password: newPassword },
    }),
  );
  await sql("UPDATE profiles SET upload_limit=1 WHERE id=?", [userA]);
  const temporary = await a.post("/api/auth/login", {
    data: { email: account.email, password: newPassword, remember: false },
  });
  await body(temporary);
  assert(!/Max-Age=|Expires=/i.test(temporary.headers()["set-cookie"] || ""));
  const persistent = await a.post("/api/auth/login", {
    data: { email: account.email, password: newPassword, remember: true },
  });
  await body(persistent);
  assert(/Max-Age=2592000/i.test(persistent.headers()["set-cookie"] || ""));
  const reserved = await Promise.all(
    [0, 1].map(() =>
      a.post("/api/uploads/request", {
        data: {
          name: "atomic.png",
          bytes: 100,
          mime: "image/png",
          key: randomUUID(),
        },
      }),
    ),
  );
  assert.deepEqual(reserved.map((r) => r.status()).sort(), [200, 422]);
  const denied = reserved.find((r) => r.status() === 422)!;
  assert.match((await denied.json()).error, /UPLOAD_CONCURRENCY/);
  console.log(
    "PASS: email verification, cookie sessions, owner isolation, roles, revisions, upload, private files, worker export, idempotency, moderation, revoke, suspended accounts, logout.",
  );
} finally {
  for (const id of ids) {
    const files = (
      await sql("SELECT path,thumbnail_path FROM assets WHERE owner_id=?", [id])
    )
      .flatMap((r) => [r.path, r.thumbnail_path])
      .filter(Boolean);
    files.push(
      ...(
        await sql(
          "SELECT result FROM jobs WHERE owner_id=? AND kind='export'",
          [id],
        )
      )
        .map((r) => r.result?.path)
        .filter(Boolean),
    );
    await storage.from("media").remove(files);
    await sql("DELETE FROM audit_log WHERE actor_id=?", [id]);
    await sql("DELETE FROM share_links WHERE owner_id=?", [id]);
    await sql(
      "DELETE r FROM asset_references r JOIN games g ON g.id=r.game_id WHERE g.owner_id=?",
      [id],
    );
    for (const t of ["play_sessions", "questions", "games", "jobs", "assets"])
      await sql(`DELETE FROM ${t} WHERE owner_id=?`, [id]);
    await sql("DELETE FROM profiles WHERE id=?", [id]);
    await sql("DELETE FROM users WHERE id=?", [id]);
  }
  await a.dispose();
  await b.dispose();
  await pool.end();
}

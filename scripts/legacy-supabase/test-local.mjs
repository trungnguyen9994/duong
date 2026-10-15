import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
const publicEnv = Object.fromEntries(
  (await readFile(".env.local", "utf8"))
    .trim()
    .split(/\r?\n/)
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const admin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  ),
  created = [];
const api = async (token, path, method = "GET", body) => {
  const response = await fetch(`http://127.0.0.1:8787/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
};
try {
  const users = [];
  for (const label of ["a", "b"]) {
    const email = `integration-${label}-${crypto.randomUUID()}@example.test`,
      password = crypto.randomUUID() + "aA1!";
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.ifError(error);
    created.push(data.user.id);
    const client = createClient(
      process.env.SUPABASE_URL,
      publicEnv.VITE_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } },
    );
    const login = await client.auth.signInWithPassword({ email, password });
    assert.ifError(login.error);
    users.push({
      client,
      id: data.user.id,
      token: login.data.session.access_token,
    });
  }
  const [a, b] = users,
    id = crypto.randomUUID();
  const spec = {
    schemaVersion: 1,
    id,
    kind: "journey",
    template: { type: "journey", version: 1 },
    metadata: {
      title: "Integration",
      description: "",
      subjectId: "math",
      grade: 3,
    },
    settings: {
      teams: ["A", "B"],
      timerSeconds: 45,
      pointsFirst: 10,
      pointsRetry: 5,
      muted: true,
      reducedMotion: true,
    },
    media: { fit: "cover", x: 50, y: 50, zoom: 1, opacity: 1, alt: "" },
    content: {
      stages: [1, 2, 3, 4].map((n) => ({
        id: crypto.randomUUID(),
        title: `Chặng ${n}`,
        multiplier: 1,
        questions: [],
      })),
    },
  };
  const saved = await api(a.token, `/games/${id}`, "PUT", {
    spec,
    revision: 0,
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.revision, 1);
  assert.equal((await api(b.token, `/games/${id}`)).status, 404);
  const cross = await b.client.from("games").select("*").eq("id", id);
  assert.ifError(cross.error);
  assert.deepEqual(cross.data, []);
  const role = await a.client
    .from("profiles")
    .update({ role: "super_admin" })
    .eq("id", a.id);
  assert.ok(role.error);
  const rpc = await a.client.rpc("save_game", {
    p_owner: b.id,
    p_spec: spec,
    p_revision: 1,
    p_assets: [],
  });
  assert.ok(rpc.error);
  const stale = await api(a.token, `/games/${id}`, "PUT", {
    spec,
    revision: 0,
  });
  assert.equal(stale.status, 409);
  const pngFake = Buffer.from("<html>not an image</html>");
  const request = await api(a.token, "/uploads/request", "POST", {
    name: "fake.png",
    bytes: pngFake.length,
    mime: "image/png",
    key: crypto.randomUUID(),
  });
  assert.equal(request.status, 200, JSON.stringify(request.body));
  const upload = await a.client.storage
    .from("uploads")
    .uploadToSignedUrl(request.body.path, request.body.token, pngFake, {
      contentType: "image/png",
    });
  assert.ifError(upload.error);
  assert.equal(
    (await api(a.token, `/uploads/${request.body.jobId}/complete`, "POST"))
      .status,
    200,
  );
  let rejected;
  for (let i = 0; i < 30; i++) {
    rejected = await api(a.token, `/jobs/${request.body.jobId}`);
    if (rejected.body.status === "failed") break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(rejected.body.status, "failed");
  assert.match(rejected.body.error, /Chữ ký/);
  const file = await sharp(await readFile("public/art/forest.png"))
    .jpeg({ quality: 95 })
    .toBuffer();
  const key = crypto.randomUUID(),
    valid = await api(a.token, "/uploads/request", "POST", {
      name: "forest.jpg",
      bytes: file.length,
      mime: "image/jpeg",
      key,
    });
  assert.equal(valid.status, 200, JSON.stringify(valid.body));
  const repeated = await api(a.token, "/uploads/request", "POST", {
    name: "forest.jpg",
    bytes: file.length,
    mime: "image/jpeg",
    key,
  });
  assert.equal(repeated.body.jobId, valid.body.jobId);
  assert.ifError(
    (
      await a.client.storage
        .from("uploads")
        .uploadToSignedUrl(valid.body.path, valid.body.token, file, {
          contentType: "image/jpeg",
        })
    ).error,
  );
  await api(a.token, `/uploads/${valid.body.jobId}/complete`, "POST");
  await api(a.token, `/uploads/${valid.body.jobId}/complete`, "POST");
  let completed;
  for (let i = 0; i < 30; i++) {
    completed = await api(a.token, `/jobs/${valid.body.jobId}`);
    if (["failed", "completed"].includes(completed.body.status)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(
    completed.body.status,
    "completed",
    JSON.stringify(completed.body),
  );
  spec.media.backgroundId = valid.body.assetId;
  assert.equal(
    (
      await api(b.token, `/assets/${valid.body.assetId}`, "PATCH", {
        altText: "Ảnh rừng",
        revision: 1,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await api(a.token, `/assets/${valid.body.assetId}`, "PATCH", {
        altText: "Khu rừng xanh",
        revision: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await api(a.token, `/assets/${valid.body.assetId}`, "PATCH", {
        altText: "Bản cũ",
        revision: 1,
      })
    ).status,
    409,
  );
  const cropInput = {
    key: crypto.randomUUID(),
    crop: {
      fit: "contain",
      x: 50,
      y: 50,
      zoom: 1.2,
      opacity: 0.7,
      aspect: "4:5",
    },
  };
  assert.equal(
    (
      await api(
        b.token,
        `/assets/${valid.body.assetId}/crop`,
        "POST",
        cropInput,
      )
    ).status,
    403,
  );
  const cropped = await api(
    a.token,
    `/assets/${valid.body.assetId}/crop`,
    "POST",
    cropInput,
  );
  assert.equal(cropped.status, 200, JSON.stringify(cropped.body));
  let cropJob;
  for (let i = 0; i < 30; i++) {
    cropJob = await api(a.token, `/jobs/${cropped.body.id}`);
    if (["completed", "failed"].includes(cropJob.body.status)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(cropJob.body.status, "completed", JSON.stringify(cropJob.body));
  const cropRow = await admin
    .from("assets")
    .select("width,height")
    .eq("id", cropJob.body.result.assetId)
    .single();
  assert.equal(cropRow.data.width, 512);
  assert.equal(cropRow.data.height, 640);
  assert.equal(
    (await api(a.token, `/games/${id}`, "PUT", { spec, revision: 1 })).status,
    200,
  );
  assert.equal(
    (await api(a.token, `/assets/${valid.body.assetId}`, "DELETE")).status,
    409,
  );
  const forbidden = { ...spec, id: crypto.randomUUID() };
  assert.notEqual(
    (
      await api(b.token, `/games/${forbidden.id}`, "PUT", {
        spec: forbidden,
        revision: 0,
      })
    ).status,
    200,
  );
  assert.equal((await api(b.token, `/jobs/${valid.body.jobId}`)).status, 422);
  const direct = await b.client.storage
    .from("media")
    .download(`${a.id}/${valid.body.assetId}.webp`);
  assert.ok(direct.error);
  for (const stage of spec.content.stages)
    stage.questions = [
      {
        id: crypto.randomUUID(),
        prompt: "2 × 3 = ?",
        choices: ["5", "6", "7", "8"],
        correct: 1,
        hint: "Hai nhóm, mỗi nhóm ba.",
        explanation: "2 × 3 = 6",
      },
    ];
  assert.equal(
    (await api(a.token, `/games/${id}`, "PUT", { spec, revision: 2 })).status,
    200,
  );
  const exportKey = crypto.randomUUID(),
    exp = await api(a.token, "/exports", "POST", { spec, key: exportKey });
  assert.equal(exp.status, 200, JSON.stringify(exp.body));
  const duplicate = await api(a.token, "/exports", "POST", {
    spec,
    key: exportKey,
  });
  assert.equal(duplicate.body.id, exp.body.id);
  let exportJob;
  for (let i = 0; i < 40; i++) {
    exportJob = await api(a.token, `/jobs/${exp.body.id}`);
    if (["failed", "completed"].includes(exportJob.body.status)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(
    exportJob.body.status,
    "completed",
    JSON.stringify(exportJob.body),
  );
  const dl = await api(a.token, `/exports/${exp.body.id}/download`);
  assert.equal(dl.status, 200);
  const pptx = Buffer.from(
    await (await fetch(dl.body.signedUrl)).arrayBuffer(),
  );
  assert.equal(pptx.subarray(0, 2).toString(), "PK");
  for (const kind of ["picture_reveal", "word_wheel"]) {
    const other = {
      ...spec,
      id: crypto.randomUUID(),
      kind,
      template: { type: kind, version: 1 },
      content:
        kind === "picture_reveal"
          ? {
              size: 6,
              imageId: valid.body.assetId,
              answer: "Rừng cây",
              earlyGuess: true,
              questions: Array.from({ length: 6 }, () => ({
                id: crypto.randomUUID(),
                prompt: "Cây cần gì?",
                choices: ["Nước", "Đá", "Nhựa", "Sắt"],
                correct: 0,
                hint: "Dùng để tưới cây.",
                explanation: "Cây cần nước.",
              })),
            }
          : {
              phrase: "CÁNH DIỀU",
              clue: "Bay trong gió",
              segments: [10, 20, 30, 40, 10, 20, 30, "lose_turn"],
            },
    };
    const queued = await api(a.token, "/exports", "POST", {
      spec: other,
      key: crypto.randomUUID(),
    });
    assert.equal(queued.status, 200, JSON.stringify(queued.body));
    let completed;
    for (let i = 0; i < 40; i++) {
      completed = await api(a.token, `/jobs/${queued.body.id}`);
      if (["completed", "failed"].includes(completed.body.status)) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    assert.equal(
      completed.body.status,
      "completed",
      JSON.stringify(completed.body),
    );
  }
  assert.equal(
    (
      await api(a.token, `/admin/accounts/${a.id}`, "PATCH", {
        role: "super_admin",
      })
    ).status,
    403,
  );
  assert.equal((await api(a.token, "/admin/accounts")).status, 403);
  const submitted = await api(a.token, `/games/${id}/submit`, "POST", {
    revision: 3,
  });
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
  assert.equal(
    (
      await api(a.token, `/admin/moderation/${id}`, "POST", {
        revision: 4,
        approve: true,
      })
    ).status,
    403,
  );
  assert.ifError(
    (
      await admin
        .from("profiles")
        .update({ role: "admin", permissions: ["moderation"] })
        .eq("id", b.id)
    ).error,
  );
  assert.equal((await api(b.token, "/admin/accounts")).status, 403);
  const approved = await api(b.token, `/admin/moderation/${id}`, "POST", {
    revision: 4,
    approve: true,
  });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal(
    (await api("", `/public/shares/${approved.body.shareId}`)).status,
    200,
  );
  assert.equal(
    (await api(a.token, `/games/${id}/revoke`, "POST", { revision: 5 })).status,
    200,
  );
  assert.equal(
    (await api("", `/public/shares/${approved.body.shareId}`)).status,
    404,
  );
  const requests = await Promise.all(
    [0, 1, 2].map((i) =>
      api(a.token, "/uploads/request", "POST", {
        name: `quota-${i}.png`,
        bytes: 100,
        mime: "image/png",
        key: crypto.randomUUID(),
      }),
    ),
  );
  assert.equal(requests.filter((r) => r.status === 200).length, 2);
  assert.equal(
    requests.filter((r) => r.body.error?.includes("UPLOAD_CONCURRENCY")).length,
    1,
  );
  assert.equal(
    (
      await api(a.token, "/uploads/request", "POST", {
        name: "oversize.png",
        bytes: 5242881,
        mime: "image/png",
        key: crypto.randomUUID(),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api(a.token, "/uploads/request", "POST", {
        name: "unsafe.svg",
        bytes: 100,
        mime: "image/svg+xml",
        key: crypto.randomUUID(),
      })
    ).status,
    400,
  );
  assert.ifError(
    (
      await admin
        .from("profiles")
        .update({ daily_export_limit: 1 })
        .eq("id", a.id)
    ).error,
  );
  const quota = await api(a.token, "/exports", "POST", {
    spec,
    key: crypto.randomUUID(),
  });
  assert.match(quota.body.error, /EXPORT_DAILY_QUOTA/);
  assert.ifError(
    (
      await admin
        .from("profiles")
        .update({ status: "suspended" })
        .eq("id", a.id)
    ).error,
  );
  assert.equal((await api(a.token, "/dashboard")).status, 403);
  assert.deepEqual((await a.client.from("games").select("*")).data, []);
  console.log(
    "PASS: owner/RLS isolation, role permissions, revision, signed media, fake PNG/SVG/size checks, atomic upload quota, daily export quota, server PPTX, moderation, public share/revocation, suspended account.",
  );
} finally {
  for (const id of created) {
    const { data: exports } = await admin.storage
      .from("media")
      .list(`${id}/exports`);
    if (exports?.length)
      await admin.storage
        .from("media")
        .remove(exports.map((f) => `${id}/exports/${f.name}`));
    const { data: files } = await admin.storage.from("media").list(id);
    if (files?.length)
      await admin.storage
        .from("media")
        .remove(files.map((f) => `${id}/${f.name}`));
    const { data: uploads } = await admin.storage.from("uploads").list(id);
    if (uploads?.length)
      await admin.storage
        .from("uploads")
        .remove(uploads.map((f) => `${id}/${f.name}`));
    // profiles intentionally do not cascade owned content; delete fixture records explicitly.
    await admin.from("games").delete().eq("owner_id", id);
    await admin.from("jobs").delete().eq("owner_id", id);
    await admin.from("assets").delete().eq("owner_id", id);
    await admin.from("audit_log").delete().eq("actor_id", id);
    await admin.auth.admin.deleteUser(id);
  }
}

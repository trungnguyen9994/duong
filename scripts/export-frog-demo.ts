import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createStudioGame } from "../src/domain/studio-spec";
import { isAdventure } from "../src/domain/adventure-config";
import { renderPptx } from "../server/pptx";
const requested = process.argv[2];
const type = requested && isAdventure(requested) ? requested : "clever_frog";
const spec = createStudioGame(type);
if (!("questions" in spec.content)) throw Error();
spec.metadata.title += " – Ôn bảng nhân 3";
spec.content.questions.forEach((q, i) => {
  q.prompt = `${i + 1} × 3 bằng bao nhiêu?`;
  q.choices[0] = String((i + 1) * 3);
  if (type !== "clever_frog" && type !== "forest_rescue")
    q.choices = [
      String((i + 1) * 3),
      String((i + 1) * 3 + 1),
      String((i + 1) * 3 - 1),
      type === "boat_rescue" ? "" : String((i + 1) * 3 + 2),
    ];
  q.explanation = `Lấy ${i + 1} ba lần được ${(i + 1) * 3}.`;
});
let output: Buffer;
if (process.env.FROG_TEST_EMAIL && process.env.FROG_TEST_PASSWORD) {
  const base = "http://127.0.0.1:8787";
  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.FROG_TEST_EMAIL,
      password: process.env.FROG_TEST_PASSWORD,
      remember: false,
    }),
  });
  if (!login.ok) throw Error("Không đăng nhập được để kiểm tra export.");
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  const request = async (path: string, body?: unknown) => {
    const response = await fetch(`${base}${path}`, {
      method: body ? "POST" : "GET",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw Error(await response.text());
    return response.json();
  };
  try {
    const job = await request("/api/exports", {
      spec,
      key: crypto.randomUUID(),
    });
    let ready = false;
    for (let i = 0; i < 40; i++) {
      const status = await request(`/api/jobs/${job.id}`);
      if (status.status === "failed") throw Error(status.error);
      if (status.status === "completed") {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!ready) throw Error("Export chưa hoàn thành.");
    const download = await request(`/api/exports/${job.id}/download`);
    const response = await fetch(new URL(download.signedUrl, base), {
      headers: { Cookie: cookie },
    });
    if (!response.ok) throw Error("Không tải được PPTX.");
    output = Buffer.from(await response.arrayBuffer());
    console.log("API → worker → tải file: thành công.");
  } finally {
    await request("/api/auth/logout", {});
  }
} else output = await renderPptx(spec, new Map());
const folder = resolve("data/previews");
await mkdir(folder, { recursive: true });
const path = resolve(
  folder,
  type === "clever_frog" ? `ech-xanh-muu-tri-demo${process.env.EXPORT_REVISION || ""}.pptx` : `${type}-demo${process.env.EXPORT_REVISION || ""}.pptx`,
);
await writeFile(path, output);
console.log(path, output.length, "bytes");

import assert from "node:assert/strict";
import { createStudioGame } from "../src/domain/studio-spec";
import { DEMO_FOREST_IMAGE } from "../src/domain/demo-assets";
const base = "http://127.0.0.1:8787/api";
const login = await fetch(`${base}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: process.env.FROG_TEST_EMAIL,
    password: process.env.FROG_TEST_PASSWORD,
    remember: false,
  }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie")!.split(";")[0];
const spec = createStudioGame("picture_reveal");
if (spec.kind !== "picture_reveal") throw Error();
spec.content.imageId = DEMO_FOREST_IMAGE;
spec.content.answer = "Rừng cây";
spec.content.questions = Array.from({ length: 6 }, () => ({
  id: crypto.randomUUID(),
  prompt: "Cây cần gì?",
  choices: ["Nước", "Nhựa", "Sắt", "Đá"],
  correct: 0,
  hint: "",
  explanation: "",
}));
try {
  const request = () =>
    JSON.stringify({ spec, demo: true, key: crypto.randomUUID() });
  const anonymous = await fetch(`${base}/exports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: request(),
  });
  assert.equal(anonymous.status, 401);
  const response = await fetch(`${base}/exports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: request(),
  });
  const responseBody = await response.json();
  assert.equal(response.status, 200, JSON.stringify(responseBody));
  const job = responseBody;
  let completed = false;
  for (let i = 0; i < 60; i++) {
    const state = await (
      await fetch(`${base}/jobs/${job.id}`, { headers: { Cookie: cookie } })
    ).json();
    if (state.status === "failed") throw Error(state.error);
    if (state.status === "completed") {
      completed = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert(completed);
  const file = await (
    await fetch(`${base}/exports/${job.id}/download`, {
      headers: { Cookie: cookie },
    })
  ).json();
  const downloaded = await fetch(new URL(file.signedUrl, base), {
    headers: { Cookie: cookie },
  });
  assert.equal(downloaded.status, 200);
  assert((await downloaded.arrayBuffer()).byteLength > 1000);
  console.log("Demo image export, authentication and download: passed");
} finally {
  await fetch(`${base}/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: "{}",
  });
}

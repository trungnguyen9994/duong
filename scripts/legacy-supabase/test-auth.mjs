import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const vars = Object.fromEntries(
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
  client = createClient(process.env.SUPABASE_URL, vars.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
const email = `email-flow-${crypto.randomUUID()}@example.test`,
  password = crypto.randomUUID() + "Aa1!";
let id;
const messages = [];
async function verify(type) {
  for (let i = 0; i < 20; i++) {
    const list = await (
      await fetch("http://127.0.0.1:55424/api/v1/messages")
    ).json();
    for (const message of list.messages || []) {
      if (
        messages.includes(message.ID) ||
        !message.To?.some((to) => to.Address === email)
      )
        continue;
      const detail = await (
        await fetch(`http://127.0.0.1:55424/api/v1/message/${message.ID}`)
      ).json();
      const url = detail.HTML?.match(
        /href="([^"]*\/auth\/v1\/verify\?[^\"]+)"/,
      )?.[1]?.replaceAll("&amp;", "&");
      if (!url || !url.includes(`type=${type}`)) continue;
      messages.push(message.ID);
      const response = await fetch(url, { redirect: "manual" });
      assert.ok([302, 303].includes(response.status));
      return response.headers.get("location");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Không tìm thấy thư ${type} của tài khoản kiểm thử.`);
}
try {
  const signup = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: "http://127.0.0.1:5173/auth/callback" },
  });
  assert.ifError(signup.error);
  id = signup.data.user.id;
  assert.equal(signup.data.session, null);
  assert.ok((await client.auth.signInWithPassword({ email, password })).error);
  await verify("signup");
  assert.ifError(
    (await client.auth.signInWithPassword({ email, password })).error,
  );
  assert.equal(
    (
      await admin
        .from("profiles")
        .select("role,status,email")
        .eq("id", id)
        .single()
    ).data.role,
    "teacher",
  );
  await client.auth.signOut();
  assert.ifError(
    (
      await client.auth.resetPasswordForEmail(email, {
        redirectTo: "http://127.0.0.1:5173/login?mode=update",
      })
    ).error,
  );
  const location = await verify("recovery"),
    params = new URLSearchParams(new URL(location).hash.slice(1));
  assert.ifError(
    (
      await client.auth.setSession({
        access_token: params.get("access_token"),
        refresh_token: params.get("refresh_token"),
      })
    ).error,
  );
  const changed = crypto.randomUUID() + "Aa2!";
  assert.ifError((await client.auth.updateUser({ password: changed })).error);
  await client.auth.signOut();
  assert.ifError(
    (await client.auth.signInWithPassword({ email, password: changed })).error,
  );
  console.log(
    "PASS: signup email delivered to local mailbox, verification required, Teacher activation and password recovery.",
  );
} finally {
  if (id) await admin.auth.admin.deleteUser(id);
  for (const message of messages)
    await fetch(`http://127.0.0.1:55424/api/v1/messages`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ IDs: [message] }),
    });
}

import express from "express";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { z } from "zod";
import { sql, transaction, result } from "./database";
import { createRateLimiter } from "./security";

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const cookieName = "edugame_session";
export function requestToken(req: express.Request) {
  return (
    req.headers.authorization?.match(/^Bearer (.+)$/)?.[1] ||
    req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1) ||
    ""
  );
}
export async function userForToken(token: string) {
  if (!token) return null;
  return (
    (
      await sql(
        "SELECT u.id,u.email,u.email_confirmed_at FROM users u JOIN auth_sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP(3)",
        [hash(token)],
      )
    )[0] || null
  );
}
const sessionCookie = (
  res: express.Response,
  token: string,
  remember: boolean,
) =>
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    ...(remember ? { maxAge: 30 * 86400000 } : {}),
    path: "/",
  });
async function newSession(id: string, res: express.Response, remember = true) {
  const token = randomBytes(32).toString("base64url");
  await sql("INSERT INTO auth_sessions VALUES (?,?,?)", [
    hash(token),
    id,
    new Date(Date.now() + (remember ? 30 * 86400000 : 8 * 3600000)),
  ]);
  sessionCookie(res, token, remember);
  return {
    user: (
      await sql("SELECT id,email,email_confirmed_at FROM users WHERE id=?", [
        id,
      ])
    )[0],
  };
}
async function mail(email: string, purpose: "verify" | "reset", id: string) {
  const token = randomBytes(32).toString("base64url");
  await sql("INSERT INTO auth_tokens VALUES (?,?,?,?)", [
    hash(token),
    id,
    purpose,
    new Date(Date.now() + 3600000),
  ]);
  const base = process.env.API_PUBLIC_URL || "http://127.0.0.1:8787",
    frontend = process.env.FRONTEND_URL || "http://127.0.0.1:5173";
  const url =
    purpose === "verify"
      ? `${base}/api/auth/verify?token=${token}`
      : `${frontend}/login?mode=update&token=${token}`;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "127.0.0.1",
    port: Number(process.env.SMTP_PORT || 55425),
    secure: process.env.SMTP_SECURE === "true",
    ...(process.env.SMTP_USER
      ? {
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        }
      : {}),
  });
  await transport.sendMail({
    from: process.env.MAIL_FROM || "EduGame Studio <no-reply@edugame.local>",
    to: email,
    subject:
      purpose === "verify"
        ? "Xác minh tài khoản EduGame Studio"
        : "Đặt lại mật khẩu EduGame Studio",
    text: `${purpose === "verify" ? "Xác minh email" : "Đặt lại mật khẩu"}: ${url}\nLiên kết dùng một lần, hết hạn sau 1 giờ.`,
  });
}
export const authRouter = express.Router();
const authLimit = createRateLimiter(
  30,
  600000,
  (req) => `${req.ip}:${req.path}`,
);
const accountLimit = createRateLimiter(
  20,
  900000,
  (req) =>
    `${req.originalUrl.split("?")[0]}:${String(req.body?.email || "")
      .trim()
      .toLowerCase()
      .slice(0, 254)}`,
);
const dummyHash = bcrypt.hashSync("invalid-account-placeholder", 12);
authRouter.use((req, res, next) => {
  if (req.method === "GET") return next();
  authLimit(req, res, next);
});
authRouter.use(["/login", "/reset", "/signup"], (req, res, next) =>
  req.method === "POST" ? accountLimit(req, res, next) : next(),
);
const credentials = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((s) => s.trim().toLowerCase()),
  password: z.string().min(8).max(128),
});
authRouter.post("/signup", async (req, res) => {
  const input = credentials
      .extend({ display_name: z.string().trim().min(1).max(100) })
      .parse(req.body),
    id = randomUUID();
  const exists = (
    await sql("SELECT id,email_confirmed_at FROM users WHERE email=?", [
      input.email,
    ])
  )[0];
  if (!exists) {
    const password = await bcrypt.hash(input.password, 12);
    await transaction(async (c) => {
      await sql(
        "INSERT INTO users(id,email,password_hash) VALUES (?,?,?)",
        [id, input.email, password],
        c,
      );
      const approval = (
        await sql(
          "SELECT value FROM app_settings WHERE `key`='require_account_approval'",
          [],
          c,
        )
      )[0]?.value;
      await sql(
        "INSERT INTO profiles(id,email,display_name,status) VALUES (?,?,?,?)",
        [id, input.email, input.display_name, approval ? "pending" : "active"],
        c,
      );
    });
  }
  if (!exists || !exists.email_confirmed_at)
    await mail(input.email, "verify", exists?.id || id);
  res.json({ session: null });
});
authRouter.get("/verify", async (req, res) => {
  const token = z.string().min(30).max(200).parse(req.query.token);
  const id = await transaction(async (c) => {
    const row = (
      await sql(
        "SELECT * FROM auth_tokens WHERE token_hash=? AND purpose='verify' AND expires_at>UTC_TIMESTAMP(3) FOR UPDATE",
        [hash(token)],
        c,
      )
    )[0];
    if (!row) throw Error("Liên kết xác minh hết hạn hoặc đã dùng.");
    await sql(
      "UPDATE users SET email_confirmed_at=UTC_TIMESTAMP(3) WHERE id=?",
      [row.user_id],
      c,
    );
    await sql(
      "DELETE FROM auth_tokens WHERE user_id=? AND purpose='verify'",
      [row.user_id],
      c,
    );
    return row.user_id;
  });
  await newSession(id, res);
  res.redirect(
    `${process.env.FRONTEND_URL || "http://127.0.0.1:5173"}/auth/callback`,
  );
});
authRouter.post("/login", async (req, res) => {
  const input = z
      .object({
        email: z
          .string()
          .trim()
          .min(1)
          .max(254)
          .transform((value) => value.toLowerCase()),
        password: z.string().min(8).max(128),
        remember: z.boolean().default(true),
      })
      .parse(req.body),
    user = (
      await sql("SELECT * FROM users WHERE email=? OR username=?", [
        input.email,
        input.email,
      ])
    )[0];
  const passwordMatches = await bcrypt.compare(
    input.password,
    user?.password_hash || dummyHash,
  );
  if (!user || !passwordMatches)
    return res
      .status(401)
      .json({ error: "Tài khoản hoặc mật khẩu không đúng." });
  if (!user.email_confirmed_at)
    return res
      .status(401)
      .json({ error: "Vui lòng xác minh email trước khi đăng nhập." });
  const profile = (
    await sql("SELECT status FROM profiles WHERE id=?", [user.id])
  )[0];
  if (profile?.status !== "active")
    return res.status(403).json({ error: "Tài khoản chưa hoạt động." });
  res.json({ session: await newSession(user.id, res, input.remember) });
});
authRouter.get("/session", async (req, res) => {
  const user = await userForToken(requestToken(req));
  res.json({ session: user ? { user } : null });
});
authRouter.post("/logout", async (req, res) => {
  await sql("DELETE FROM auth_sessions WHERE token_hash=?", [
    hash(requestToken(req)),
  ]);
  res.clearCookie(cookieName, { path: "/" });
  res.json({ ok: true });
});
authRouter.post("/reset", async (req, res) => {
  const email = z.string().email().parse(req.body.email).trim().toLowerCase(),
    u = (await sql("SELECT id FROM users WHERE email=?", [email]))[0];
  if (u) await mail(email, "reset", u.id);
  res.json({ ok: true });
});
authRouter.post("/password", async (req, res) => {
  const input = z
      .object({
        password: z.string().min(8).max(128),
        token: z.string().min(30).max(200),
      })
      .parse(req.body),
    password = await bcrypt.hash(input.password, 12);
  const id = await transaction(async (c) => {
    const t = (
      await sql(
        "SELECT * FROM auth_tokens WHERE token_hash=? AND purpose='reset' AND expires_at>UTC_TIMESTAMP(3) FOR UPDATE",
        [hash(input.token)],
        c,
      )
    )[0];
    if (!t) throw Error("Liên kết đặt lại mật khẩu hết hạn hoặc đã dùng.");
    await sql(
      "UPDATE users SET password_hash=? WHERE id=?",
      [password, t.user_id],
      c,
    );
    await sql(
      "DELETE FROM auth_tokens WHERE user_id=? AND purpose='reset'",
      [t.user_id],
      c,
    );
    await sql("DELETE FROM auth_sessions WHERE user_id=?", [t.user_id], c);
    return t.user_id;
  });
  res.json({ session: await newSession(id, res) });
});
// Operations CLI interface: no public route can change a role or bypass verification.
export const serverAuth = {
  getUser: (token: string) =>
    result(async () => ({ user: await userForToken(token) })),
  admin: {
    listUsers: ({ page = 1, perPage = 100 } = {}) =>
      result(async () => ({
        users: await sql(
          `SELECT id,email,email_confirmed_at FROM users ORDER BY created_at LIMIT ? OFFSET ?`,
          [perPage, (page - 1) * perPage],
        ),
      })),
  },
};

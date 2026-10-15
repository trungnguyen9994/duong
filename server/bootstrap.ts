import { admin, checked } from "./client";
const email = process.argv[2];
if (!email)
  throw new Error("Dùng: npm run admin:bootstrap -- email-da-xac-minh");
let page = 1,
  user;
while (!user) {
  const response = await admin.auth.admin.listUsers({ page, perPage: 100 });
  if (response.error) throw response.error;
  const result = response.data;
  user = result.users.find(
    (u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (result.users.length < 100) break;
  page++;
}
if (!user?.email_confirmed_at)
  throw new Error("Tài khoản phải được tạo và xác minh email trước.");
checked(
  await admin
    .from("profiles")
    .update({ role: "super_admin", status: "active", permissions: [] })
    .eq("id", user.id),
);
checked(
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "bootstrap_super_admin",
    target_id: user.id,
  }),
);
console.log("Đã cấp quyền Super Admin cho tài khoản được chỉ định.");

const { pool } = await import("./database");
await pool.end();

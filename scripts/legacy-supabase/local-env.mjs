import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const executable =
  process.platform === "win32"
    ? "node_modules/@supabase/cli-windows-x64/bin/supabase.exe"
    : "node_modules/.bin/supabase";
const values = JSON.parse(
  execFileSync(executable, ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }),
);
writeFileSync(
  ".env",
  `SUPABASE_URL=${values.API_URL}\nSUPABASE_SERVICE_ROLE_KEY=${values.SERVICE_ROLE_KEY}\nFRONTEND_URL=http://127.0.0.1:5173\nAPI_PORT=8787\n`,
);
writeFileSync(
  ".env.local",
  `VITE_SUPABASE_URL=${values.API_URL}\nVITE_SUPABASE_ANON_KEY=${values.ANON_KEY}\nVITE_API_URL=http://127.0.0.1:8787\n`,
);
console.log(
  "Đã ghi cấu hình local vào hai file được Git bỏ qua. Khởi động lại Vite để nạp cấu hình.",
);

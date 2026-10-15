import { storage } from "./storage";
import { randomUUID } from "node:crypto";
const path = `backup-check/${randomUUID()}.bin`;
const stored = await storage
  .from("media")
  .upload(path, Buffer.from("EduGame MariaDB backup verification"));
if (stored.error) throw Error(stored.error.message);
try {
  await import("./restore-check");
} finally {
  await storage.from("media").remove([path]);
}

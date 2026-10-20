import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

const source = fileURLToPath(new URL("../.env", import.meta.url));
const destination = fileURLToPath(
  new URL("../deploy/.env.smtp.production", import.meta.url),
);
const keys = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "MAIL_FROM",
];

try {
  const current = parse(await readFile(source, "utf8"));
  for (const key of keys) {
    if (!current[key]?.trim()) throw new Error(`Missing ${key} in local .env`);
  }
  const content = [
    "# PRIVATE: SMTP credentials for backend deployment only.",
    "# Do not commit, publish, serve as static content, or add VITE_ prefixes.",
    "# Import these variables into the hosting secret/environment settings.",
    ...keys.map((key) => `${key}=${JSON.stringify(current[key])}`),
    "",
  ].join("\n");
  const exported = parse(content);
  if (!keys.every((key) => exported[key] === current[key])) {
    throw new Error("SMTP values could not be serialized without changes");
  }
  // Never overwrite an existing deployment credential file silently.
  await writeFile(destination, content, { flag: "wx", mode: 0o600 });
  console.log("Saved deploy/.env.smtp.production (6 SMTP variables; secrets hidden).");
} catch (error) {
  if (error.code === "EEXIST") {
    console.error("Private SMTP file already exists; not overwritten.");
  } else if (error.code) {
    console.error(`SMTP export failed (${error.code}); secrets hidden.`);
  } else {
    console.error(error.message);
  }
  process.exitCode = 1;
}

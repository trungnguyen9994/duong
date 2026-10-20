const unavailableCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "PROTOCOL_CONNECTION_LOST",
  "ER_CON_COUNT_ERROR",
  "ER_SERVER_SHUTDOWN",
]);

export function databaseUnavailable(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 3) return false;
  const value = error as {
    code?: string;
    message?: string;
    cause?: unknown;
    errors?: unknown[];
  };
  return (
    unavailableCodes.has(value.code || "") ||
    /\b(?:ECONNREFUSED|ECONNRESET|ETIMEDOUT|PROTOCOL_CONNECTION_LOST)\b/.test(
      value.message || "",
    ) ||
    databaseUnavailable(value.cause, depth + 1) ||
    (Array.isArray(value.errors) &&
      value.errors.some((item) => databaseUnavailable(item, depth + 1)))
  );
}

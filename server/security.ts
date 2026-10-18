import type { RequestHandler } from "express";
import { createHash } from "node:crypto";

/** Bounded, process-local limiter. Deploy behind a shared edge limiter for replicas. */
export function createRateLimiter(
  limit: number,
  windowMs: number,
  keyOf: (req: Parameters<RequestHandler>[0]) => string = (req) =>
    req.ip || req.socket.remoteAddress || "unknown",
): RequestHandler {
  const entries = new Map<string, { count: number; until: number }>();
  return (req, res, next) => {
    const now = Date.now();
    if (entries.size >= 10000) {
      for (const [key, entry] of entries)
        if (entry.until <= now) entries.delete(key);
    }
    const key = createHash("sha256").update(keyOf(req)).digest("hex");
    let entry = entries.get(key);
    // Fail closed rather than evicting active limits under a key-flood attack.
    if (!entry && entries.size >= 10000) {
      res.setHeader("Retry-After", "60");
      res
        .status(429)
        .json({ error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." });
      return;
    }
    if (!entry || entry.until <= now) {
      entry = { count: 0, until: now + windowMs };
      entries.set(key, entry);
    }
    entry.count++;
    if (entry.count > limit) {
      res.setHeader(
        "Retry-After",
        String(Math.max(1, Math.ceil((entry.until - now) / 1000))),
      );
      res
        .status(429)
        .json({ error: "Thao tác quá nhanh. Vui lòng chờ rồi thử lại." });
      return;
    }
    next();
  };
}
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  res.setHeader("Cache-Control", "no-store");
  if (process.env.NODE_ENV === "production")
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  next();
};

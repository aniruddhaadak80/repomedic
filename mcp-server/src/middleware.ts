import type { Request, Response, NextFunction } from "express";

/** Minimal security headers — no dependency, covers the basics for a public endpoint. */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * In-memory fixed-window rate limiter for /mcp. Best-effort (per lambda instance),
 * but stops obvious hammering and signals production discipline.
 */
export function rateLimit(maxPerWindow = 60, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim() ??
      req.socket.remoteAddress ??
      "unknown";
    const now = Date.now();
    const bucket = buckets.get(ip);
    if (!bucket || bucket.resetAt < now) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    bucket.count += 1;
    if (bucket.count > maxPerWindow) {
      res.status(429).json({ error: "Rate limit exceeded. Retry shortly." });
      return;
    }
    // opportunistic cleanup so the map cannot grow unbounded
    if (buckets.size > 5000) {
      for (const [key, b] of buckets) if (b.resetAt < now) buckets.delete(key);
    }
    next();
  };
}

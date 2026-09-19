import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { Redis } from "ioredis";
import { ENV } from "./_core/env";
import { httpRequestsTotal, httpRequestDurationSeconds } from "./_core/metrics";

let redis: Redis | null = null;
try {
  redis = new Redis(ENV.redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
    retryStrategy: () => null,
  });
  redis.on("error", () => {
    // Suppress connection errors when local Redis is not running
  });
} catch {
  redis = null;
}

const memoryRateLimitMap = new Map<string, { count: number; expiresAt: number }>();
const WINDOW_SECS = 60;
const MAX_REQUESTS_PER_WINDOW = 120;

function clientKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : req.socket.remoteAddress ?? "unknown";
  return `rl:${req.path}:${ip}`;
}

function normalizeRoute(path: string): string {
  if (path.startsWith("/api/trpc")) return "/api/trpc";
  if (path.startsWith("/api/storage")) return "/api/storage";
  if (path.startsWith("/api/oauth")) return "/api/oauth";
  return path;
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = typeof req.headers["x-request-id"] === "string" && req.headers["x-request-id"].length <= 128 ? req.headers["x-request-id"] : randomUUID();
  res.setHeader("x-request-id", requestId);
  (req as Request & { requestId?: string }).requestId = requestId;
  const startedAt = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const durationSec = durationMs / 1000;
    const route = normalizeRoute(req.path);
    const statusCode = String(res.statusCode);

    httpRequestsTotal.inc({ method: req.method, route, status_code: statusCode });
    httpRequestDurationSeconds.observe({ method: req.method, route, status_code: statusCode }, durationSec);

    console.log(JSON.stringify({ event: "http_request", requestId, method: req.method, path: req.path, status: res.statusCode, durationMs }));
  });
  next();
}

export async function apiRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = clientKey(req);
  try {
    if (redis && redis.status === "ready") {
      const currentCount = await redis.incr(key);
      if (currentCount === 1) {
        await redis.expire(key, WINDOW_SECS);
      }
      if (currentCount > MAX_REQUESTS_PER_WINDOW) {
        res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many requests. Retry after the rate-limit window." } });
        return;
      }
      return next();
    }
  } catch {
    // Fall back to in-memory rate limiter
  }

  // In-memory rate limiting fallback
  const now = Date.now();
  const record = memoryRateLimitMap.get(key);
  if (!record || record.expiresAt < now) {
    memoryRateLimitMap.set(key, { count: 1, expiresAt: now + WINDOW_SECS * 1000 });
    return next();
  }

  record.count += 1;
  if (record.count > MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many requests. Retry after the rate-limit window." } });
    return;
  }
  next();
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  const scriptPolicy = process.env.NODE_ENV === "development" ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' https://cdn.jsdelivr.net";
  res.setHeader("Content-Security-Policy", `default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src ${scriptPolicy}; connect-src 'self' https: ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`);
  if (_req.secure || _req.headers["x-forwarded-proto"] === "https") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}

export function redactError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message.slice(0, 300) };
  return { name: "UnknownError", message: "Unknown error" };
}


export function assertNoPrivateMaterial(files: Array<{ path: string; content: string }>) {
  const secretPattern = /(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:private[_ -]?key|mnemonic|seed phrase|api[_ -]?key|secret)\s*[:=])/i;
  for (const file of files) {
    if (secretPattern.test(file.content)) throw new Error(`SOURCE_SECRET_REJECTED:${file.path}`);
  }
}

export function assertSafeSourcePath(path: string) {
  if (path.startsWith("/") || path.includes("..") || path.includes("\\") || path.length > 512) throw new Error("SOURCE_PATH_REJECTED");
  if (!/^[a-zA-Z0-9_./-]+$/.test(path)) throw new Error("SOURCE_PATH_REJECTED");
}

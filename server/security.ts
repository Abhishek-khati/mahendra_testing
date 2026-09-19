import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const buckets = new Map<string, { windowStartedAt: number; count: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;

function clientKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : req.socket.remoteAddress ?? "unknown";
  return `${req.path}:${ip}`;
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = typeof req.headers["x-request-id"] === "string" && req.headers["x-request-id"].length <= 128 ? req.headers["x-request-id"] : randomUUID();
  res.setHeader("x-request-id", requestId);
  (req as Request & { requestId?: string }).requestId = requestId;
  const startedAt = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    console.log(JSON.stringify({ event: "http_request", requestId, method: req.method, path: req.path, status: res.statusCode, durationMs }));
  });
  next();
}

export function apiRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = clientKey(req);
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStartedAt >= WINDOW_MS) {
    buckets.set(key, { windowStartedAt: now, count: 1 });
    return next();
  }
  bucket.count += 1;
  if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
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

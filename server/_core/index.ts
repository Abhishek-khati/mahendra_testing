import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { apiRateLimit, redactError, requestIdMiddleware, securityHeaders } from "../security";
import { queueHealth } from "../analysis/queue";
import { purgeOldRuns } from "./retention";
import { register } from "./metrics";
import { initSentry, captureException } from "./sentry";

initSentry();

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(requestIdMiddleware);
  // Source bundles are validated again at the tRPC boundary; this limit prevents oversized JSON requests.
  app.use(express.json({ limit: "12mb" }));
  app.use(express.urlencoded({ limit: "12mb", extended: true }));
  app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok", service: "chainshield-api", queue: queueHealth() }));
  app.get("/readyz", (_req, res) => {
    const ready = Boolean(process.env.DATABASE_URL && process.env.JWT_SECRET);
    res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready", databaseConfigured: Boolean(process.env.DATABASE_URL), authConfigured: Boolean(process.env.JWT_SECRET), queue: queueHealth() });
  });
  app.get("/metrics", async (_req, res) => {
    try {
      res.setHeader("Content-Type", register.contentType);
      res.send(await register.metrics());
    } catch (err) {
      res.status(500).send(err instanceof Error ? err.message : "Metrics generation error");
    }
  });
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    apiRateLimit,
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const requestId = (req as express.Request & { requestId?: string }).requestId;
    console.error(JSON.stringify({ event: "http_error", requestId, ...redactError(error) }));
    captureException(error, { requestId, path: req.path });
    if (res.headersSent) return;
    res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected server error.", requestId } });
  });
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);

    // Schedule data retention job: run once after 1 minute, then every 24 hours
    const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
    setTimeout(() => {
      purgeOldRuns().catch((err) => console.error("[Retention] Initial purge failed:", err));
      setInterval(() => {
        purgeOldRuns().catch((err) => console.error("[Retention] Scheduled purge failed:", err));
      }, RETENTION_INTERVAL_MS);
    }, 60_000); // 1 minute delay after startup
  });
}

startServer().catch(console.error);

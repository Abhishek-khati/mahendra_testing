/**
 * ChainShield AI — Isolated Analysis Worker
 *
 * Exposes a single authenticated endpoint that the main app calls to run
 * Solidity compilation (solc) and static analysis (Slither) in a sandboxed
 * environment. The worker must be deployed separately from the API process.
 *
 * Routes:
 *   GET  /health                  — liveness probe
 *   POST /v1/analysis/stages      — execute one analysis stage
 *
 * Auth: Bearer token via WORKER_SECRET_TOKEN env var.
 */

import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { executeWorkerStage } from "../server/analysis/worker-entry.js";
import type { WorkerStageRequest } from "../server/analysis/contracts.js";

const PORT = Number(process.env.WORKER_PORT ?? (process.env.NODE_ENV === "production" ? process.env.PORT : undefined) ?? 4000);
const SECRET_TOKEN = process.env.WORKER_SECRET_TOKEN?.trim();
const MAX_BODY_BYTES = 12 * 1024 * 1024; // 12 MiB — source bundle + metadata

if (!SECRET_TOKEN) {
  console.error("[worker] FATAL: WORKER_SECRET_TOKEN env var is not set. Refusing to start.");
  process.exit(1);
}

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.disable("x-powered-by");
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cache-Control", "no-store");
  next();
});

// ── Body parsing (bounded) ────────────────────────────────────────────────────
app.use(express.json({ limit: MAX_BODY_BYTES }));

// ── Bearer token auth middleware ──────────────────────────────────────────────
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"] ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token || token !== SECRET_TOKEN) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid or missing worker token." });
    return;
  }
  next();
}

// ── Logging helper ────────────────────────────────────────────────────────────
function log(requestId: string, msg: string, extra?: object) {
  const entry = { ts: new Date().toISOString(), requestId, msg, ...extra };
  console.log(JSON.stringify(entry));
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "chainshield-worker", version: "1.0.0" });
});

// ── Main analysis endpoint ────────────────────────────────────────────────────
app.post("/v1/analysis/stages", requireAuth, async (req: Request, res: Response) => {
  const requestId: string = (req.headers["x-chainshield-request-id"] as string) ?? randomUUID();

  // Validate basic shape before touching worker-entry
  const body = req.body as Partial<WorkerStageRequest>;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "BAD_REQUEST", message: "Request body must be a JSON object." });
    return;
  }
  if (!body.stage || !body.runId || !body.sourceRevision || !body.policy) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Missing required fields: stage, runId, sourceRevision, policy." });
    return;
  }
  if (!["solidity-compile", "slither", "behavioral-tests"].includes(body.stage)) {
    res.status(400).json({ error: "BAD_REQUEST", message: `Unknown stage: ${body.stage}` });
    return;
  }

  const request: WorkerStageRequest = {
    requestId,
    runId: body.runId,
    stage: body.stage,
    sourceRevision: body.sourceRevision,
    artifactKey: body.artifactKey,
    policy: body.policy,
  };

  log(requestId, "stage.start", { stage: request.stage, runId: request.runId });

  // Reconstruct source files from the sourceRevision manifest.
  // The main app sends files inline — we rehydrate them from the request body.
  const files: Array<{ path: string; content: string }> =
    (req.body as { files?: Array<{ path: string; content: string }> }).files ?? [];

  if (files.length === 0) {
    log(requestId, "stage.no_files", { stage: request.stage });
    res.status(400).json({ error: "BAD_REQUEST", message: "No source files provided." });
    return;
  }

  try {
    const result = await executeWorkerStage(request, files);
    log(requestId, "stage.complete", { stage: request.stage, status: result.status, findings: result.findings.length });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "WORKER_INTERNAL_ERROR";
    log(requestId, "stage.error", { stage: request.stage, error: message });
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Worker stage execution failed.", errorCode: message });
  }
});

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "NOT_FOUND" });
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), msg: "worker.started", port: PORT }));
});

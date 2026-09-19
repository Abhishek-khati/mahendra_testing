import { appendAuditEvent, markRunFailed, markRunStarted } from "./db";
import { executeAnalysisRun } from "./pipeline";
import type { SourceFile } from "./contracts";

const MAX_QUEUE = 50;
const MAX_CONCURRENCY = 2;
let active = 0;
const pending: Array<() => Promise<void>> = [];

async function drain() {
  while (active < MAX_CONCURRENCY && pending.length > 0) {
    const job = pending.shift();
    if (!job) return;
    active += 1;
    void job().catch(() => undefined).finally(() => {
      active -= 1;
      void drain();
    });
  }
}

export function enqueueAnalysis(input: {
  runId: number;
  userId: number;
  workspaceId: number;
  projectId: number;
  projectName: string;
  createdBy: number;
  chain?: string | null;
  revision: { revisionLabel: string; contentHash: string; compilerProfile?: { version?: string; settings?: Record<string, unknown> } };
  files: SourceFile[];
  requestedStages: string[];
}): boolean {
  if (pending.length >= MAX_QUEUE) return false;
  pending.push(async () => {
    await markRunStarted(input.runId);
    try {
      await executeAnalysisRun(input);
      await appendAuditEvent({ workspaceId: input.workspaceId, actorId: input.userId, action: "scan.completed", targetType: "analysisRun", targetId: String(input.runId), metadataJson: { projectId: input.projectId } });
    } catch (error) {
      await markRunFailed(input.runId, error instanceof Error ? error.message.slice(0, 96) : "PIPELINE_FAILED");
      await appendAuditEvent({ workspaceId: input.workspaceId, actorId: input.userId, action: "scan.failed", targetType: "analysisRun", targetId: String(input.runId), metadataJson: { projectId: input.projectId } });
    }
  });
  void drain();
  return true;
}

export function queueHealth() {
  return { pending: pending.length, active, maxQueue: MAX_QUEUE, maxConcurrency: MAX_CONCURRENCY, durable: false };
}

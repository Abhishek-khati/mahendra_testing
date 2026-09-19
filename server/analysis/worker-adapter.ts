import type { WorkerStageRequest, WorkerStageResult } from "./contracts";

export interface AnalysisWorkerAdapter {
  execute(request: WorkerStageRequest): Promise<WorkerStageResult>;
}

const unsupportedResult = (request: WorkerStageRequest, errorCode: string, limitation: string): WorkerStageResult => ({
  requestId: request.requestId,
  stage: request.stage,
  status: "unsupported",
  workerVersion: "adapter/1.0.0",
  errorCode,
  limitations: [limitation],
  findings: [],
  evidence: [],
  toolMetadata: {
    solc: "not-executed",
    slither: "not-executed",
    sandbox: "external-worker-required",
  },
});

/**
 * Production default: source is never executed in the API process. A dedicated
 * worker service can be connected later through this contract after it provides
 * network isolation, a read-only source mount, CPU/memory/time limits, and a
 * signed result envelope. Returning unsupported is safer than fabricating a
 * compiler or Slither result when that worker is not configured.
 */
export class ExternalSandboxWorkerAdapter implements AnalysisWorkerAdapter {
  private readonly endpoint = process.env.CHAINSHIELD_WORKER_URL?.trim();
  private readonly token = process.env.CHAINSHIELD_WORKER_TOKEN?.trim();

  async execute(request: WorkerStageRequest): Promise<WorkerStageResult> {
    if (!this.endpoint || !this.token) {
      return unsupportedResult(
        request,
        "WORKER_NOT_CONFIGURED",
        "Solidity compilation, Slither, and behavioral execution require a separately sandboxed worker; no worker endpoint is configured.",
      );
    }

    const response = await fetch(`${this.endpoint.replace(/\/$/, "")}/v1/analysis/stages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.token}`,
        "x-chainshield-request-id": request.requestId,
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(request.policy.timeoutMs),
    });

    if (!response.ok) {
      return unsupportedResult(
        request,
        `WORKER_HTTP_${response.status}`,
        `The isolated worker returned HTTP ${response.status}; no security conclusion was produced for this stage.`,
      );
    }

    const payload = (await response.json()) as WorkerStageResult;
    if (payload.requestId !== request.requestId || payload.stage !== request.stage) {
      return unsupportedResult(
        request,
        "WORKER_RESPONSE_MISMATCH",
        "The isolated worker response did not match the immutable request envelope.",
      );
    }
    return payload;
  }
}

export const analysisWorker = new ExternalSandboxWorkerAdapter();

import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { ExternalSandboxWorkerAdapter } from "./worker-adapter";

describe("analysis security boundaries", () => {
  it("requires authentication before workspace access", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    await expect(appRouter.createCaller(ctx).analysis.workspace()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("does not fabricate compiler or Slither output without an isolated worker", async () => {
    const adapter = new ExternalSandboxWorkerAdapter();
    const result = await adapter.execute({
      requestId: "test-request",
      runId: 1,
      stage: "solidity-compile",
      sourceRevision: { revisionLabel: "test", contentHash: "hash", sourceKind: "fixture", files: [] },
      policy: { timeoutMs: 100, networkAccess: "disabled", maxOutputBytes: 1024 },
    });
    expect(result.status).toBe("unsupported");
    expect(result.errorCode).toBe("WORKER_NOT_CONFIGURED");
    expect(result.limitations.join(" ")).toContain("sandboxed worker");
  });
});

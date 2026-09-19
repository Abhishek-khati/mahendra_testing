import { describe, expect, it } from "vitest";
import { register, httpRequestsTotal } from "../_core/metrics";
import { verifyReportHash } from "./report-verify";

describe("Prometheus Metrics & Report Verification", () => {
  it("exposes properly formatted Prometheus metrics", async () => {
    httpRequestsTotal.inc({ method: "GET", route: "/healthz", status_code: "200" });
    const output = await register.metrics();
    expect(output).toContain("chainshield_http_requests_total");
    expect(output).toContain('route="/healthz"');
    expect(output).toContain('status_code="200"');
  });

  it("verifies canonical report integrity hash correctly", () => {
    const reportData = {
      projectId: 1,
      runId: 42,
      summary: { high: 2, medium: 1, low: 0 },
      findings: [
        { title: "Reentrancy in withdraw()", severity: "high" }
      ]
    };

    const crypto = require("node:crypto");
    const expectedHash = crypto.createHash("sha256").update(JSON.stringify(reportData)).digest("hex");

    expect(verifyReportHash(reportData, expectedHash)).toBe(true);
    expect(verifyReportHash(reportData, "invalid_hash_00000000000000000000000000000000000000000000000000000000")).toBe(false);
  });
});

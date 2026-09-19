import { describe, expect, it } from "vitest";
import { runCustomDetectors } from "./custom-detectors";
import { normalizeFindings } from "./normalizer";

describe("custom deterministic detectors", () => {
  it("reports conservative hypotheses with line evidence", () => {
    const findings = runCustomDetectors([{ path: "src/Vault.sol", content: "contract Vault { function f() external { (bool ok,) = msg.sender.call(\"\"); balance = 1; } }" }]);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.classification).toBe("hypothesis");
    expect(findings[0]?.evidence[0]?.filePath).toBe("src/Vault.sol");
    expect(findings[0]?.evidence[0]?.startLine).toBeGreaterThan(0);
  });

  it("correlates the same candidate while preserving limitations", () => {
    const base = runCustomDetectors([{ path: "src/Vault.sol", content: "contract Vault { function f() external { tx.origin; } }" }]);
    const first = { requestId: "1", stage: "custom-deterministic" as const, status: "succeeded" as const, workerVersion: "test", limitations: [], findings: base, evidence: base.flatMap(item => item.evidence), toolMetadata: {} };
    const result = normalizeFindings([first, first]);
    expect(result).toHaveLength(1);
    expect(result[0]?.limitations.length).toBeGreaterThan(0);
    expect(result[0]?.lifecycle).toBe("needs_review");
  });
});

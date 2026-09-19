import { describe, expect, it } from "vitest";
import { sha256 } from "./evidence";
import { verifyReportHash } from "./report-verify";

describe("report integrity", () => {
  it("verifies the exact report payload hash and rejects mutation", () => {
    const report = { schemaVersion: "1.0", findings: [], limitations: ["needs review"] };
    const hash = sha256(JSON.stringify(report));
    expect(verifyReportHash(report, hash)).toBe(true);
    expect(verifyReportHash({ ...report, limitations: [] }, hash)).toBe(false);
  });
});

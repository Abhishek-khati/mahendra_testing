import type { FindingCandidate, NormalizedFinding, WorkerStageResult } from "./contracts";
import { sha256 } from "./evidence";

function fingerprintFor(candidate: FindingCandidate): string {
  const evidence = candidate.evidence[0];
  return sha256([
    candidate.detector.engine,
    candidate.detector.ruleId,
    evidence?.filePath ?? "unknown",
    evidence?.codeHash ?? "no-code",
    candidate.title,
  ].join("|"));
}

export function normalizeFindings(results: WorkerStageResult[]): NormalizedFinding[] {
  const byFingerprint = new Map<string, NormalizedFinding>();
  for (const result of results) {
    for (const candidate of result.findings) {
      const fingerprint = fingerprintFor(candidate);
      const existing = byFingerprint.get(fingerprint);
      if (!existing) {
        byFingerprint.set(fingerprint, {
          ...candidate,
          fingerprint,
          lifecycle: candidate.confidence === "low" || candidate.classification === "hypothesis" ? "needs_review" : "observed",
        });
        continue;
      }
      const mergedEvidence = [...existing.evidence];
      for (const evidence of candidate.evidence) {
        if (!mergedEvidence.some(item => item.evidenceId === evidence.evidenceId)) mergedEvidence.push(evidence);
      }
      byFingerprint.set(fingerprint, {
        ...existing,
        confidence: existing.confidence === "high" || candidate.confidence === "high" ? "high" : existing.confidence === "medium" || candidate.confidence === "medium" ? "medium" : "low",
        evidence: mergedEvidence,
        limitations: Array.from(new Set([...existing.limitations, ...candidate.limitations])),
      });
    }
  }
  return Array.from(byFingerprint.values());
}

export function calculateCoverage(results: WorkerStageResult[]) {
  const succeeded = results.filter(result => result.status === "succeeded").length;
  const unsupported = results.filter(result => result.status === "unsupported").length;
  const evidenceCount = results.reduce((total, result) => total + result.evidence.length, 0);
  return {
    stagesRequested: results.length,
    stagesSucceeded: succeeded,
    stagesUnsupported: unsupported,
    findingsWithEvidence: evidenceCount,
    partial: unsupported > 0 || results.some(result => result.status === "failed"),
  };
}

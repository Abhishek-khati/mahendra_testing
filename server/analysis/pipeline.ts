import { randomUUID } from "node:crypto";
import type { FindingCandidate, ReportDocument, SourceFile, WorkerStageResult } from "./contracts";
import { runCustomDetectors } from "./custom-detectors";
import { sha256 } from "./evidence";
import { normalizeFindings, calculateCoverage } from "./normalizer";
import { analysisWorker } from "./worker-adapter";
import { savePipelineResults, saveReport } from "./db";

function stageResult(stage: WorkerStageResult["stage"], candidates: FindingCandidate[]): WorkerStageResult {
  return {
    requestId: randomUUID(),
    stage,
    status: "succeeded",
    workerVersion: "api-deterministic/1.0.0",
    limitations: ["Deterministic source-text detectors do not prove exploitability, reachability, or economic impact."],
    findings: candidates,
    evidence: candidates.flatMap(candidate => candidate.evidence),
    toolMetadata: { detector: "custom-rules/1.0.0", execution: "api-process-string-analysis-only" },
  };
}

export async function executeAnalysisRun(input: {
  runId: number;
  projectId: number;
  projectName: string;
  createdBy: number;
  chain?: string | null;
  revision: { revisionLabel: string; contentHash: string; compilerProfile?: { version?: string; settings?: Record<string, unknown> } };
  files: SourceFile[];
  requestedStages: string[];
}) {
  const results: WorkerStageResult[] = [];
  const compilerProfile = input.revision.compilerProfile ?? {};
  const workerPolicy = { timeoutMs: 120_000, networkAccess: "disabled" as const, maxOutputBytes: 8 * 1024 * 1024 };
  const sourceRevision = {
    revisionLabel: input.revision.revisionLabel,
    contentHash: input.revision.contentHash,
    sourceKind: "upload" as const,
    files: input.files.map(file => ({ path: file.path, sha256: file.sha256 ?? sha256(file.content), bytes: Buffer.byteLength(file.content) })),
    compilerProfile,
  };

  if (input.requestedStages.includes("solidity-compile")) {
    results.push(await analysisWorker.execute({ requestId: randomUUID(), runId: input.runId, stage: "solidity-compile", sourceRevision, policy: workerPolicy }));
  }
  if (input.requestedStages.includes("slither")) {
    results.push(await analysisWorker.execute({ requestId: randomUUID(), runId: input.runId, stage: "slither", sourceRevision, policy: workerPolicy }));
  }
  if (input.requestedStages.includes("custom-deterministic")) {
    results.push(stageResult("custom-deterministic", runCustomDetectors(input.files)));
  }
  if (input.requestedStages.includes("behavioral-tests")) {
    results.push(await analysisWorker.execute({ requestId: randomUUID(), runId: input.runId, stage: "behavioral-tests", sourceRevision, policy: workerPolicy }));
  }

  const normalized = normalizeFindings(results);
  const coverage = calculateCoverage(results);
  const toolchain = Object.fromEntries(results.flatMap(result => Object.entries(result.toolMetadata)));
  const report: ReportDocument = {
    schemaVersion: "1.0",
    runId: input.runId,
    project: { id: input.projectId, name: input.projectName, chain: input.chain },
    generatedAt: new Date().toISOString(),
    status: coverage.partial ? "partial" : "final",
    toolchain,
    coverage: {
      stagesRequested: coverage.stagesRequested,
      stagesSucceeded: coverage.stagesSucceeded,
      stagesUnsupported: coverage.stagesUnsupported,
      findingsWithEvidence: coverage.findingsWithEvidence,
    },
    findings: normalized,
    limitations: Array.from(new Set(results.flatMap(result => result.limitations))),
    reviewerChecklist: [
      "Confirm every high or critical observation against the exact source revision.",
      "Validate compiler, Slither, and test tool versions in the evidence manifest.",
      "Do not treat a missing or unsupported stage as evidence of safety.",
      "Run a retest after any suggested patch; AI-generated fixes are not applied automatically.",
    ],
  };

  const status = coverage.partial ? "partial" : normalized.some(item => item.severity === "critical" || item.severity === "high") ? "partial" : "completed";
  await savePipelineResults({
    runId: input.runId,
    projectId: input.projectId,
    stages: results.map(result => ({ stageType: result.stage, status: result.status === "unsupported" ? "skipped" : result.status, workerVersion: result.workerVersion, errorCode: result.errorCode })),
    evidence: results.flatMap(result => result.evidence.map(evidence => ({ evidenceType: evidence.source, evidenceHash: evidence.codeHash, extractorVersion: evidence.extractorVersion, provenanceJson: { source: evidence.source, filePath: evidence.filePath, startLine: evidence.startLine, endLine: evidence.endLine }, payloadJson: evidence }))),
    findings: normalized.map(item => ({ fingerprint: item.fingerprint, title: item.title, category: item.category, classification: item.classification, severity: item.severity, confidence: item.confidence, lifecycle: item.lifecycle, description: item.description })),
    coverage,
    status,
  });
  const reportId = await saveReport({ projectId: input.projectId, runId: input.runId, createdBy: input.createdBy, contentJson: report, contentHash: sha256(JSON.stringify(report)) });
  return { status, coverage, findings: normalized, report, reportId };
}

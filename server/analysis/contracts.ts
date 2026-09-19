export const ANALYSIS_STAGES = [
  "source-ingest",
  "solidity-compile",
  "slither",
  "custom-deterministic",
  "behavioral-tests",
  "normalize-findings",
  "contextual-ai",
  "report",
] as const;

export type AnalysisStage = (typeof ANALYSIS_STAGES)[number];
export type StageStatus = "queued" | "running" | "succeeded" | "failed" | "skipped" | "unsupported";
export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Confidence = "high" | "medium" | "low";
export type FindingClassification = "vulnerability" | "warning" | "optimization" | "informational" | "hypothesis";

export type SourceFile = {
  path: string;
  content: string;
  sha256?: string;
};

export type SourceManifest = {
  revisionLabel: string;
  contentHash: string;
  files: Array<Pick<SourceFile, "path" | "sha256"> & { bytes: number }>;
  sourceKind: "upload" | "repository" | "fixture";
  compilerProfile?: {
    version?: string;
    settings?: Record<string, unknown>;
  };
};

export type EvidenceSlice = {
  evidenceId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
  codeHash: string;
  source: "compiler" | "slither" | "custom-detector" | "behavioral-test" | "deployment";
  extractorVersion: string;
  limitations?: string[];
};

export type DetectorReference = {
  engine: "solc" | "slither" | "custom" | "behavioral" | "deployment";
  ruleId: string;
  version: string;
  url?: string;
};

export type FindingCandidate = {
  title: string;
  category: string;
  classification: FindingClassification;
  severity: Severity;
  confidence: Confidence;
  description: string;
  detector: DetectorReference;
  evidence: EvidenceSlice[];
  suggestedMitigation?: string;
  limitations: string[];
};

export type NormalizedFinding = FindingCandidate & {
  fingerprint: string;
  lifecycle: "observed" | "needs_review";
};

export type WorkerStageRequest = {
  requestId: string;
  runId: number;
  stage: "solidity-compile" | "slither" | "behavioral-tests";
  sourceRevision: SourceManifest;
  artifactKey?: string;
  policy: {
    timeoutMs: number;
    networkAccess: "disabled" | "allowlisted";
    maxOutputBytes: number;
  };
};

export type WorkerStageResult = {
  requestId: string;
  stage: AnalysisStage;
  status: "succeeded" | "failed" | "unsupported";
  workerVersion: string;
  errorCode?: string;
  limitations: string[];
  artifact?: {
    objectKey: string;
    sha256: string;
    mediaType: string;
    byteSize: number;
  };
  findings: FindingCandidate[];
  evidence: EvidenceSlice[];
  toolMetadata: Record<string, string>;
};

export type AiFindingAnalysis = {
  findingExplanation: string;
  impactExplanation: string;
  affectedFunction: string;
  affectedLines: string;
  relevantCodeSnippet: string;
  attackScenario: string;
  whyItMatters: string;
  confidence: Confidence;
  evidenceUsed: string[];
  suggestedMitigation: string;
  suggestedPatch: string;
  limitations: string[];
  reviewStatus: "needs_review" | "ready_for_human_review";
};

export type ReportDocument = {
  schemaVersion: "1.0";
  runId: number;
  project: { id: number; name: string; chain?: string | null };
  generatedAt: string;
  status: "draft" | "partial" | "final";
  toolchain: Record<string, string>;
  coverage: {
    stagesRequested: number;
    stagesSucceeded: number;
    stagesUnsupported: number;
    findingsWithEvidence: number;
  };
  findings: NormalizedFinding[];
  limitations: string[];
  reviewerChecklist: string[];
};

export function isAnalysisStage(value: string): value is AnalysisStage {
  return (ANALYSIS_STAGES as readonly string[]).includes(value);
}

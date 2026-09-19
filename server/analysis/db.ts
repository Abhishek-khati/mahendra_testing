import { and, desc, eq, or } from "drizzle-orm";
import {
  analysisProfiles,
  auditEvents,
  analysisRuns,
  artifacts,
  evidenceItems,
  findingOccurrences,
  findingRecords,
  findingReviews,
  projects,
  reports,
  runStages,
  sourceRevisions,
  workspaceMembers,
  workspaces,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { sha256 } from "./evidence";

export async function getOwnedProject(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select({ project: projects })
    .from(projects)
    .innerJoin(workspaces, eq(workspaces.id, projects.workspaceId))
    .leftJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, userId)))
    .where(and(eq(projects.id, projectId), or(eq(workspaces.ownerId, userId), eq(workspaceMembers.userId, userId))))
    .limit(1);
  return rows[0]?.project;
}

export async function getOrCreateWorkspaceProject(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const existing = await db.select({ workspace: workspaces, project: projects })
    .from(workspaces)
    .leftJoin(projects, eq(projects.workspaceId, workspaces.id))
    .where(eq(workspaces.ownerId, userId))
    .orderBy(workspaces.id)
    .limit(1);
  if (existing[0]?.workspace && existing[0]?.project) return existing[0];

  const workspaceId = (await db.insert(workspaces).values({ ownerId: userId, name: "Security workspace", slug: `workspace-${userId}` }).$returningId())[0]?.id;
  if (!workspaceId) throw new Error("WORKSPACE_CREATE_FAILED");
  await db.insert(workspaceMembers).values({ workspaceId, userId, role: "owner" });
  const projectId = (await db.insert(projects).values({ workspaceId, name: "Aster Protocol", slug: "aster-protocol", chain: "mainnet" }).$returningId())[0]?.id;
  if (!projectId) throw new Error("PROJECT_CREATE_FAILED");
  const profileId = (await db.insert(analysisProfiles).values({
    projectId,
    version: "profile/1.0.0",
    enabledStagesJson: ["source-ingest", "solidity-compile", "slither", "custom-deterministic", "behavioral-tests", "normalize-findings", "contextual-ai", "report"],
    toolchainJson: { solc: "external-worker", slither: "external-worker", behavioral: "external-worker" },
    policyJson: { networkAccess: "disabled", timeoutMs: 120000, maxOutputBytes: 8388608 },
    createdBy: userId,
  }).$returningId())[0]?.id;
  if (!profileId) throw new Error("PROFILE_CREATE_FAILED");
  await db.update(projects).set({ defaultProfileId: profileId }).where(eq(projects.id, projectId));
  const created = await db.select({ workspace: workspaces, project: projects }).from(workspaces).innerJoin(projects, eq(projects.workspaceId, workspaces.id)).where(eq(projects.id, projectId)).limit(1);
  return created[0];
}

export async function createQueuedRun(input: {
  projectId: number;
  requestedBy: number;
  idempotencyKey: string;
  sourceKind: "fixture" | "upload" | "repository";
  revisionLabel: string;
  contentHash: string;
  manifestJson: unknown;
  artifactKey?: string;
  profileId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const existing = await db.select().from(analysisRuns).where(and(eq(analysisRuns.projectId, input.projectId), eq(analysisRuns.idempotencyKey, input.idempotencyKey))).limit(1);
  if (existing[0]) return existing[0];
  const revisionId = (await db.insert(sourceRevisions).values({
    projectId: input.projectId,
    createdBy: input.requestedBy,
    sourceKind: input.sourceKind,
    revisionLabel: input.revisionLabel,
    contentHash: input.contentHash,
    manifestJson: input.manifestJson,
    artifactKey: input.artifactKey,
  }).$returningId())[0]?.id;
  if (!revisionId) throw new Error("REVISION_CREATE_FAILED");
  const runId = (await db.insert(analysisRuns).values({
    projectId: input.projectId,
    sourceRevisionId: revisionId,
    profileId: input.profileId,
    requestedBy: input.requestedBy,
    idempotencyKey: input.idempotencyKey,
    status: "queued",
  }).$returningId())[0]?.id;
  if (!runId) throw new Error("RUN_CREATE_FAILED");
  await db.insert(runStages).values([
    "source-ingest", "solidity-compile", "slither", "custom-deterministic", "behavioral-tests", "normalize-findings", "contextual-ai", "report",
  ].map(stageType => ({ runId, stageType, attempt: 1, status: "queued" as const })));
  const run = await db.select().from(analysisRuns).where(eq(analysisRuns.id, runId)).limit(1);
  return run[0];
}

export async function getRunForUser(userId: number, runId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ run: analysisRuns, project: projects })
    .from(analysisRuns)
    .innerJoin(projects, eq(projects.id, analysisRuns.projectId))
    .innerJoin(workspaces, eq(workspaces.id, projects.workspaceId))
    .leftJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, userId)))
    .where(and(eq(analysisRuns.id, runId), or(eq(workspaces.ownerId, userId), eq(workspaceMembers.userId, userId))))
    .limit(1);
  return rows[0];
}

export async function markRunStarted(runId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.update(analysisRuns).set({ status: "running", startedAt: new Date() }).where(eq(analysisRuns.id, runId));
}


export async function savePipelineResults(input: {
  runId: number;
  projectId: number;
  stages: Array<{ stageType: string; status: "succeeded" | "failed" | "skipped"; workerVersion: string; errorCode?: string }>;
  evidence: Array<{ stageId?: number; evidenceType: string; evidenceHash: string; extractorVersion: string; provenanceJson: unknown; payloadJson: unknown }>;
  findings: Array<{ fingerprint: string; title: string; category: string; classification: "vulnerability" | "warning" | "optimization" | "informational" | "hypothesis"; severity: "critical" | "high" | "medium" | "low" | "info"; confidence: "high" | "medium" | "low"; lifecycle: "observed" | "needs_review"; description: string }>;
  coverage: unknown;
  status: "completed" | "partial" | "failed";
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.update(analysisRuns).set({ status: input.status, coverageJson: input.coverage, completedAt: new Date() }).where(eq(analysisRuns.id, input.runId));
  for (const stage of input.stages) {
    await db.update(runStages).set({ status: stage.status, workerVersion: stage.workerVersion, errorCode: stage.errorCode, completedAt: new Date() }).where(and(eq(runStages.runId, input.runId), eq(runStages.stageType, stage.stageType), eq(runStages.attempt, 1)));
  }
  for (const evidence of input.evidence) {
    await db.insert(evidenceItems).values({ runId: input.runId, stageId: evidence.stageId ?? 0, evidenceType: evidence.evidenceType, evidenceHash: evidence.evidenceHash, extractorVersion: evidence.extractorVersion, provenanceJson: evidence.provenanceJson, payloadJson: evidence.payloadJson }).onDuplicateKeyUpdate({ set: { payloadJson: evidence.payloadJson } });
  }
  for (const finding of input.findings) {
    await db.insert(findingRecords).values({ projectId: input.projectId, runId: input.runId, fingerprint: finding.fingerprint, title: finding.title, category: finding.category, classification: finding.classification, severity: finding.severity, confidence: finding.confidence, lifecycle: finding.lifecycle, description: finding.description }).onDuplicateKeyUpdate({ set: { runId: input.runId, description: finding.description, updatedAt: new Date() } });
  }
}

export async function getRunFindings(userId: number, runId: number) {
  const run = await getRunForUser(userId, runId);
  if (!run) return undefined;
  const db = await getDb();
  if (!db) return undefined;
  const findings = await db.select().from(findingRecords).where(eq(findingRecords.runId, runId)).orderBy(desc(findingRecords.severity));
  const occurrences = await db.select().from(findingOccurrences).where(eq(findingOccurrences.runId, runId));
  const stages = await db.select().from(runStages).where(eq(runStages.runId, runId)).orderBy(runStages.id);
  return { run: run.run, project: run.project, findings, occurrences, stages };
}

export async function getFindingDetail(userId: number, findingId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ finding: findingRecords, project: projects })
    .from(findingRecords)
    .innerJoin(projects, eq(projects.id, findingRecords.projectId))
    .innerJoin(workspaces, eq(workspaces.id, projects.workspaceId))
    .leftJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, userId)))
    .where(and(eq(findingRecords.id, findingId), or(eq(workspaces.ownerId, userId), eq(workspaceMembers.userId, userId))))
    .limit(1);
  if (!rows[0]) return undefined;
  const evidence = await db.select().from(evidenceItems).where(eq(evidenceItems.runId, rows[0].finding.runId));
  const occurrences = await db.select().from(findingOccurrences).where(eq(findingOccurrences.findingId, findingId));
  return { ...rows[0], evidence, occurrences };
}

export async function saveReport(input: { projectId: number; runId: number; createdBy: number; contentJson: unknown; contentHash: string }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const existing = await db.select({ version: reports.version }).from(reports).where(eq(reports.projectId, input.projectId)).orderBy(desc(reports.version)).limit(1);
  const version = (existing[0]?.version ?? 0) + 1;
  const reportId = (await db.insert(reports).values({ projectId: input.projectId, runId: input.runId, version, reportStatus: "draft", contentJson: input.contentJson, contentHash: input.contentHash, createdBy: input.createdBy }).$returningId())[0]?.id;
  return reportId;
}


export async function saveFindingAiAnalysis(findingId: number, aiAnalysisJson: unknown) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.update(findingRecords).set({ aiAnalysisJson, lifecycle: "needs_review", updatedAt: new Date() }).where(eq(findingRecords.id, findingId));
}


export async function getLatestReport(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const owned = await getOwnedProject(userId, projectId);
  if (!owned) return undefined;
  const rows = await db.select().from(reports).where(eq(reports.projectId, projectId)).orderBy(desc(reports.version)).limit(1);
  return rows[0];
}


export async function getProjectAccess(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ project: projects, workspace: workspaces, memberRole: workspaceMembers.role })
    .from(projects)
    .innerJoin(workspaces, eq(workspaces.id, projects.workspaceId))
    .leftJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, userId)))
    .where(and(eq(projects.id, projectId), or(eq(workspaces.ownerId, userId), eq(workspaceMembers.userId, userId))))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  return { ...row, role: row.workspace.ownerId === userId ? "owner" as const : row.memberRole ?? "viewer" as const };
}


export async function markRunFailed(runId: number, errorCode: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(analysisRuns).set({ status: "failed", errorCode, completedAt: new Date() }).where(eq(analysisRuns.id, runId));
}

export async function appendAuditEvent(input: { workspaceId: number; actorId?: number; action: string; targetType: string; targetId: string; metadataJson?: unknown }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const previous = await db.select({ eventHash: auditEvents.eventHash }).from(auditEvents).where(eq(auditEvents.workspaceId, input.workspaceId)).orderBy(desc(auditEvents.id)).limit(1);
  const predecessorHash = previous[0]?.eventHash;
  const payload = JSON.stringify({ ...input, predecessorHash });
  const eventHash = sha256(payload);
  await db.insert(auditEvents).values({ workspaceId: input.workspaceId, actorId: input.actorId, action: input.action, targetType: input.targetType, targetId: input.targetId, metadataJson: input.metadataJson, predecessorHash, eventHash });
  return eventHash;
}


export async function reviewFinding(input: { userId: number; findingId: number; decision: "confirm" | "false_positive" | "accepted_risk" | "needs_retest" | "reopen"; rationale: string }) {
  const detail = await getFindingDetail(input.userId, input.findingId);
  if (!detail) return undefined;
  const access = await getProjectAccess(input.userId, detail.project.id);
  if (!access || !["owner", "maintainer", "reviewer"].includes(access.role)) throw new Error("REVIEWER_ACCESS_REQUIRED");
  const lifecycle = input.decision === "confirm" ? "triaged" : input.decision === "false_positive" ? "false_positive" : input.decision === "accepted_risk" ? "accepted_risk" : input.decision === "needs_retest" ? "remediated_pending_retest" : "reopened";
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.insert(findingReviews).values({ findingId: input.findingId, reviewerId: input.userId, decision: input.decision, rationale: input.rationale, reviewVersion: 1 });
  await db.update(findingRecords).set({ lifecycle, updatedAt: new Date() }).where(eq(findingRecords.id, input.findingId));
  return { findingId: input.findingId, lifecycle };
}

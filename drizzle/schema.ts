import {
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  index,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const workspaces = mysqlTable("workspaces", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 160 }).notNull(),
  status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  ownerIdx: index("workspace_owner_idx").on(table.ownerId),
  slugIdx: uniqueIndex("workspace_slug_idx").on(table.slug),
}));

export const workspaceMembers = mysqlTable("workspaceMembers", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "maintainer", "reviewer", "viewer"]).default("viewer").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  membershipIdx: uniqueIndex("workspace_membership_idx").on(table.workspaceId, table.userId),
}));

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 180 }).notNull(),
  chain: varchar("chain", { length: 80 }),
  defaultProfileId: int("defaultProfileId"),
  status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  workspaceIdx: index("project_workspace_idx").on(table.workspaceId),
  slugIdx: uniqueIndex("project_workspace_slug_idx").on(table.workspaceId, table.slug),
}));

export const sourceRevisions = mysqlTable("sourceRevisions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  createdBy: int("createdBy").notNull(),
  sourceKind: mysqlEnum("sourceKind", ["upload", "repository", "fixture"]).notNull(),
  revisionLabel: varchar("revisionLabel", { length: 180 }).notNull(),
  contentHash: varchar("contentHash", { length: 128 }).notNull(),
  manifestJson: json("manifestJson").notNull(),
  artifactKey: varchar("artifactKey", { length: 512 }),
  compilerProfileJson: json("compilerProfileJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  projectHashIdx: uniqueIndex("source_project_hash_idx").on(table.projectId, table.contentHash),
  projectIdx: index("source_project_idx").on(table.projectId),
}));

export const analysisProfiles = mysqlTable("analysisProfiles", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  version: varchar("version", { length: 64 }).notNull(),
  enabledStagesJson: json("enabledStagesJson").notNull(),
  toolchainJson: json("toolchainJson").notNull(),
  policyJson: json("policyJson").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  profileProjectIdx: index("profile_project_idx").on(table.projectId),
}));

export const analysisRuns = mysqlTable("analysisRuns", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  sourceRevisionId: int("sourceRevisionId").notNull(),
  profileId: int("profileId").notNull(),
  requestedBy: int("requestedBy").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["queued", "running", "completed", "partial", "failed", "cancelled"]).default("queued").notNull(),
  coverageJson: json("coverageJson"),
  errorCode: varchar("errorCode", { length: 96 }),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  idempotencyIdx: uniqueIndex("run_idempotency_idx").on(table.projectId, table.idempotencyKey),
  projectIdx: index("run_project_idx").on(table.projectId),
}));

export const runStages = mysqlTable("runStages", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  stageType: varchar("stageType", { length: 64 }).notNull(),
  attempt: int("attempt").default(1).notNull(),
  status: mysqlEnum("status", ["queued", "running", "succeeded", "failed", "skipped", "cancelled"]).default("queued").notNull(),
  workerVersion: varchar("workerVersion", { length: 128 }),
  resultArtifactKey: varchar("resultArtifactKey", { length: 512 }),
  errorCode: varchar("errorCode", { length: 96 }),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  runStageAttemptIdx: uniqueIndex("run_stage_attempt_idx").on(table.runId, table.stageType, table.attempt),
  runIdx: index("run_stage_idx").on(table.runId),
}));

export const artifacts = mysqlTable("artifacts", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  stageId: int("stageId"),
  artifactType: varchar("artifactType", { length: 96 }).notNull(),
  objectKey: varchar("objectKey", { length: 512 }).notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  mediaType: varchar("mediaType", { length: 160 }).notNull(),
  byteSize: int("byteSize").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  hashIdx: uniqueIndex("artifact_hash_idx").on(table.sha256),
  runIdx: index("artifact_run_idx").on(table.runId),
}));

export const evidenceItems = mysqlTable("evidenceItems", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  stageId: int("stageId").notNull(),
  evidenceType: varchar("evidenceType", { length: 96 }).notNull(),
  evidenceHash: varchar("evidenceHash", { length: 64 }).notNull(),
  extractorVersion: varchar("extractorVersion", { length: 128 }).notNull(),
  provenanceJson: json("provenanceJson").notNull(),
  payloadJson: json("payloadJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  evidenceHashIdx: uniqueIndex("evidence_hash_idx").on(table.evidenceHash),
  runIdx: index("evidence_run_idx").on(table.runId),
}));

export const findingRecords = mysqlTable("findingRecords", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  runId: int("runId").notNull(),
  fingerprint: varchar("fingerprint", { length: 128 }).notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  category: varchar("category", { length: 120 }).notNull(),
  classification: mysqlEnum("classification", ["vulnerability", "warning", "optimization", "informational", "hypothesis"]).notNull(),
  severity: mysqlEnum("severity", ["critical", "high", "medium", "low", "info"]).notNull(),
  confidence: mysqlEnum("confidence", ["high", "medium", "low"]).notNull(),
  lifecycle: mysqlEnum("lifecycle", ["observed", "triaged", "needs_review", "false_positive", "accepted_risk", "remediated_pending_retest", "retested", "resolved", "reopened"]).default("observed").notNull(),
  description: text("description").notNull(),
  aiAnalysisJson: json("aiAnalysisJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectFingerprintIdx: uniqueIndex("finding_project_fingerprint_idx").on(table.projectId, table.fingerprint),
  runIdx: index("finding_run_idx").on(table.runId),
}));

export const findingOccurrences = mysqlTable("findingOccurrences", {
  id: int("id").autoincrement().primaryKey(),
  findingId: int("findingId").notNull(),
  runId: int("runId").notNull(),
  filePath: varchar("filePath", { length: 512 }).notNull(),
  startLine: int("startLine").notNull(),
  endLine: int("endLine").notNull(),
  codeHash: varchar("codeHash", { length: 64 }).notNull(),
  detectorRefsJson: json("detectorRefsJson").notNull(),
  evidenceIdsJson: json("evidenceIdsJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  findingIdx: index("occurrence_finding_idx").on(table.findingId),
  runIdx: index("occurrence_run_idx").on(table.runId),
}));

export const findingReviews = mysqlTable("findingReviews", {
  id: int("id").autoincrement().primaryKey(),
  findingId: int("findingId").notNull(),
  reviewerId: int("reviewerId").notNull(),
  decision: mysqlEnum("decision", ["confirm", "false_positive", "accepted_risk", "needs_retest", "reopen"]).notNull(),
  rationale: text("rationale").notNull(),
  reviewVersion: int("reviewVersion").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  findingIdx: index("review_finding_idx").on(table.findingId),
}));

export const testScenarios = mysqlTable("testScenarios", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  createdBy: int("createdBy").notNull(),
  scenarioKey: varchar("scenarioKey", { length: 128 }).notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  kind: mysqlEnum("kind", ["invariant", "fuzz", "threat"]).notNull(),
  specification: text("specification").notNull(),
  harnessArtifactKey: varchar("harnessArtifactKey", { length: 512 }),
  enabled: int("enabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  projectScenarioIdx: uniqueIndex("project_scenario_idx").on(table.projectId, table.scenarioKey),
}));

export const testExecutions = mysqlTable("testExecutions", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  scenarioId: int("scenarioId").notNull(),
  framework: varchar("framework", { length: 96 }).notNull(),
  status: mysqlEnum("status", ["passed", "failed", "skipped", "unsupported", "timed_out"]).notNull(),
  coverageJson: json("coverageJson"),
  evidenceIdsJson: json("evidenceIdsJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  runScenarioIdx: uniqueIndex("run_scenario_idx").on(table.runId, table.scenarioId),
}));

export const dependencies = mysqlTable("dependencies", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  dependencyType: varchar("dependencyType", { length: 96 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  network: varchar("network", { length: 96 }),
  addressOrIdentifier: varchar("addressOrIdentifier", { length: 240 }),
  criticality: mysqlEnum("criticality", ["critical", "high", "medium", "low", "unknown"]).default("unknown").notNull(),
  source: varchar("source", { length: 120 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  projectIdx: index("dependency_project_idx").on(table.projectId),
}));

export const deploymentTargets = mysqlTable("deploymentTargets", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  network: varchar("network", { length: 96 }).notNull(),
  address: varchar("address", { length: 128 }).notNull(),
  proxyMetadataJson: json("proxyMetadataJson"),
  privilegedActorsJson: json("privilegedActorsJson"),
  status: mysqlEnum("status", ["unverified", "partially_verified", "verified", "stale"]).default("unverified").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  projectTargetIdx: uniqueIndex("project_target_idx").on(table.projectId, table.network, table.address),
}));

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  runId: int("runId").notNull(),
  version: int("version").default(1).notNull(),
  reportStatus: mysqlEnum("reportStatus", ["draft", "final", "superseded"]).default("draft").notNull(),
  contentJson: json("contentJson").notNull(),
  contentHash: varchar("contentHash", { length: 64 }).notNull(),
  artifactKey: varchar("artifactKey", { length: 512 }),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  projectVersionIdx: uniqueIndex("report_project_version_idx").on(table.projectId, table.version),
  runIdx: index("report_run_idx").on(table.runId),
}));

export const reportAnchors = mysqlTable("reportAnchors", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  network: varchar("network", { length: 96 }).notNull(),
  payloadHash: varchar("payloadHash", { length: 64 }).notNull(),
  transactionHash: varchar("transactionHash", { length: 128 }),
  status: mysqlEnum("status", ["requested", "submitted", "confirmed", "failed"]).default("requested").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const auditEvents = mysqlTable("auditEvents", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  actorId: int("actorId"),
  action: varchar("action", { length: 120 }).notNull(),
  targetType: varchar("targetType", { length: 96 }).notNull(),
  targetId: varchar("targetId", { length: 128 }).notNull(),
  requestId: varchar("requestId", { length: 128 }),
  metadataJson: json("metadataJson"),
  predecessorHash: varchar("predecessorHash", { length: 64 }),
  eventHash: varchar("eventHash", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  workspaceIdx: index("audit_workspace_idx").on(table.workspaceId),
  createdIdx: index("audit_created_idx").on(table.createdAt),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type SourceRevision = typeof sourceRevisions.$inferSelect;
export type AnalysisRun = typeof analysisRuns.$inferSelect;
export type RunStage = typeof runStages.$inferSelect;
export type FindingRecord = typeof findingRecords.$inferSelect;
export type FindingOccurrence = typeof findingOccurrences.$inferSelect;
export type Report = typeof reports.$inferSelect;

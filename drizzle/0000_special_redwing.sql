CREATE TABLE `analysisProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`version` varchar(64) NOT NULL,
	`enabledStagesJson` json NOT NULL,
	`toolchainJson` json NOT NULL,
	`policyJson` json NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analysisProfiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analysisRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`sourceRevisionId` int NOT NULL,
	`profileId` int NOT NULL,
	`requestedBy` int NOT NULL,
	`idempotencyKey` varchar(128) NOT NULL,
	`status` enum('queued','running','completed','partial','failed','cancelled') NOT NULL DEFAULT 'queued',
	`coverageJson` json,
	`errorCode` varchar(96),
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analysisRuns_id` PRIMARY KEY(`id`),
	CONSTRAINT `run_idempotency_idx` UNIQUE(`projectId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `artifacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`stageId` int,
	`artifactType` varchar(96) NOT NULL,
	`objectKey` varchar(512) NOT NULL,
	`sha256` varchar(64) NOT NULL,
	`mediaType` varchar(160) NOT NULL,
	`byteSize` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `artifacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `artifact_hash_idx` UNIQUE(`sha256`)
);
--> statement-breakpoint
CREATE TABLE `auditEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`actorId` int,
	`action` varchar(120) NOT NULL,
	`targetType` varchar(96) NOT NULL,
	`targetId` varchar(128) NOT NULL,
	`requestId` varchar(128),
	`metadataJson` json,
	`predecessorHash` varchar(64),
	`eventHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dependencies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`dependencyType` varchar(96) NOT NULL,
	`name` varchar(180) NOT NULL,
	`network` varchar(96),
	`addressOrIdentifier` varchar(240),
	`criticality` enum('critical','high','medium','low','unknown') NOT NULL DEFAULT 'unknown',
	`source` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dependencies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deploymentTargets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`network` varchar(96) NOT NULL,
	`address` varchar(128) NOT NULL,
	`proxyMetadataJson` json,
	`privilegedActorsJson` json,
	`status` enum('unverified','partially_verified','verified','stale') NOT NULL DEFAULT 'unverified',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deploymentTargets_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_target_idx` UNIQUE(`projectId`,`network`,`address`)
);
--> statement-breakpoint
CREATE TABLE `evidenceItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`stageId` int NOT NULL,
	`evidenceType` varchar(96) NOT NULL,
	`evidenceHash` varchar(64) NOT NULL,
	`extractorVersion` varchar(128) NOT NULL,
	`provenanceJson` json NOT NULL,
	`payloadJson` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evidenceItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `evidence_hash_idx` UNIQUE(`evidenceHash`)
);
--> statement-breakpoint
CREATE TABLE `findingOccurrences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`findingId` int NOT NULL,
	`runId` int NOT NULL,
	`filePath` varchar(512) NOT NULL,
	`startLine` int NOT NULL,
	`endLine` int NOT NULL,
	`codeHash` varchar(64) NOT NULL,
	`detectorRefsJson` json NOT NULL,
	`evidenceIdsJson` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `findingOccurrences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `findingRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`runId` int NOT NULL,
	`fingerprint` varchar(128) NOT NULL,
	`title` varchar(240) NOT NULL,
	`category` varchar(120) NOT NULL,
	`classification` enum('vulnerability','warning','optimization','informational','hypothesis') NOT NULL,
	`severity` enum('critical','high','medium','low','info') NOT NULL,
	`confidence` enum('high','medium','low') NOT NULL,
	`lifecycle` enum('observed','triaged','needs_review','false_positive','accepted_risk','remediated_pending_retest','retested','resolved','reopened') NOT NULL DEFAULT 'observed',
	`description` text NOT NULL,
	`aiAnalysisJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `findingRecords_id` PRIMARY KEY(`id`),
	CONSTRAINT `finding_project_fingerprint_idx` UNIQUE(`projectId`,`fingerprint`)
);
--> statement-breakpoint
CREATE TABLE `findingReviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`findingId` int NOT NULL,
	`reviewerId` int NOT NULL,
	`decision` enum('confirm','false_positive','accepted_risk','needs_retest','reopen') NOT NULL,
	`rationale` text NOT NULL,
	`reviewVersion` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `findingReviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`chain` varchar(80),
	`defaultProfileId` int,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_workspace_slug_idx` UNIQUE(`workspaceId`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `reportAnchors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`network` varchar(96) NOT NULL,
	`payloadHash` varchar(64) NOT NULL,
	`transactionHash` varchar(128),
	`status` enum('requested','submitted','confirmed','failed') NOT NULL DEFAULT 'requested',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reportAnchors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`runId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`reportStatus` enum('draft','final','superseded') NOT NULL DEFAULT 'draft',
	`contentJson` json NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`artifactKey` varchar(512),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `report_project_version_idx` UNIQUE(`projectId`,`version`)
);
--> statement-breakpoint
CREATE TABLE `runStages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`stageType` varchar(64) NOT NULL,
	`attempt` int NOT NULL DEFAULT 1,
	`status` enum('queued','running','succeeded','failed','skipped','cancelled') NOT NULL DEFAULT 'queued',
	`workerVersion` varchar(128),
	`resultArtifactKey` varchar(512),
	`errorCode` varchar(96),
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `runStages_id` PRIMARY KEY(`id`),
	CONSTRAINT `run_stage_attempt_idx` UNIQUE(`runId`,`stageType`,`attempt`)
);
--> statement-breakpoint
CREATE TABLE `sourceRevisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`createdBy` int NOT NULL,
	`sourceKind` enum('upload','repository','fixture') NOT NULL,
	`revisionLabel` varchar(180) NOT NULL,
	`contentHash` varchar(128) NOT NULL,
	`manifestJson` json NOT NULL,
	`artifactKey` varchar(512),
	`compilerProfileJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sourceRevisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `source_project_hash_idx` UNIQUE(`projectId`,`contentHash`)
);
--> statement-breakpoint
CREATE TABLE `testExecutions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`scenarioId` int NOT NULL,
	`framework` varchar(96) NOT NULL,
	`status` enum('passed','failed','skipped','unsupported','timed_out') NOT NULL,
	`coverageJson` json,
	`evidenceIdsJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `testExecutions_id` PRIMARY KEY(`id`),
	CONSTRAINT `run_scenario_idx` UNIQUE(`runId`,`scenarioId`)
);
--> statement-breakpoint
CREATE TABLE `testScenarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`createdBy` int NOT NULL,
	`scenarioKey` varchar(128) NOT NULL,
	`title` varchar(240) NOT NULL,
	`kind` enum('invariant','fuzz','threat') NOT NULL,
	`specification` text NOT NULL,
	`harnessArtifactKey` varchar(512),
	`enabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `testScenarios_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_scenario_idx` UNIQUE(`projectId`,`scenarioKey`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `workspaceMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','maintainer','reviewer','viewer') NOT NULL DEFAULT 'viewer',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workspaceMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspace_membership_idx` UNIQUE(`workspaceId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspace_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `profile_project_idx` ON `analysisProfiles` (`projectId`);--> statement-breakpoint
CREATE INDEX `run_project_idx` ON `analysisRuns` (`projectId`);--> statement-breakpoint
CREATE INDEX `artifact_run_idx` ON `artifacts` (`runId`);--> statement-breakpoint
CREATE INDEX `audit_workspace_idx` ON `auditEvents` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `auditEvents` (`createdAt`);--> statement-breakpoint
CREATE INDEX `dependency_project_idx` ON `dependencies` (`projectId`);--> statement-breakpoint
CREATE INDEX `evidence_run_idx` ON `evidenceItems` (`runId`);--> statement-breakpoint
CREATE INDEX `occurrence_finding_idx` ON `findingOccurrences` (`findingId`);--> statement-breakpoint
CREATE INDEX `occurrence_run_idx` ON `findingOccurrences` (`runId`);--> statement-breakpoint
CREATE INDEX `finding_run_idx` ON `findingRecords` (`runId`);--> statement-breakpoint
CREATE INDEX `review_finding_idx` ON `findingReviews` (`findingId`);--> statement-breakpoint
CREATE INDEX `project_workspace_idx` ON `projects` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `report_run_idx` ON `reports` (`runId`);--> statement-breakpoint
CREATE INDEX `run_stage_idx` ON `runStages` (`runId`);--> statement-breakpoint
CREATE INDEX `source_project_idx` ON `sourceRevisions` (`projectId`);--> statement-breakpoint
CREATE INDEX `workspace_owner_idx` ON `workspaces` (`ownerId`);
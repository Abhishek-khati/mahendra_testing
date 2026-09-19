import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { enqueueAnalysis, queueHealth } from "./analysis/queue";
import { analyzeFindingWithAi } from "./analysis/ai-analysis";
import {
  appendAuditEvent,
  createQueuedRun,
  getFindingDetail,
  getLatestReport,
  getLatestRunForUser,
  getOrCreateWorkspaceProject,
  getProjectAccess,
  getReportAnchor,
  getRunFindings,
  reviewFinding,
  saveReportAnchor,
  saveFindingAiAnalysis,
} from "./analysis/db";
import { manifestForFiles } from "./analysis/evidence";
import { persistSourceBundle } from "./analysis/source-bundle";
import { verifyReportHash } from "./analysis/report-verify";
import { assertNoPrivateMaterial, assertSafeSourcePath } from "./security";
import { extractZipSafely } from "./analysis/archive";
import { anchorReportOnChain } from "./analysis/anchor";
import { fetchGitHubRepoFiles } from "./analysis/github";

const DEFAULT_STAGES = ["source-ingest", "solidity-compile", "slither", "custom-deterministic", "behavioral-tests", "normalize-findings", "contextual-ai", "report"];

const sourceFileInput = z.object({
  path: z.string().min(1).max(512).regex(/^[a-zA-Z0-9_./-]+$/),
  content: z.string().max(750_000),
});

const sourceFilesInput = z.array(sourceFileInput).max(100).superRefine((files, ctx) => {
  const totalBytes = files.reduce((sum, file) => sum + Buffer.byteLength(file.content, "utf8"), 0);
  if (totalBytes > 10 * 1024 * 1024) ctx.addIssue({ code: "custom", message: "Source bundle exceeds the 10 MiB limit." });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  analysis: router({
    workspace: protectedProcedure.query(async ({ ctx }) => {
      const result = await getOrCreateWorkspaceProject(ctx.user.id);
      return { workspace: result.workspace, project: result.project };
    }),

    fetchGitHubRepo: protectedProcedure
      .input(z.object({
        url: z.string().min(3).max(256),
        branch: z.string().max(100).optional(),
        subpath: z.string().max(256).optional(),
      }))
      .mutation(async ({ input }) => {
        return fetchGitHubRepoFiles(input);
      }),

    startScan: protectedProcedure
      .input(z.object({
        projectId: z.number().int().positive().optional(),
        sourceKind: z.enum(["fixture", "upload", "repository"]).default("upload"),
        revisionLabel: z.string().min(1).max(180),
        idempotencyKey: z.string().min(8).max(128),
        files: sourceFilesInput.default([]),
        archiveBase64: z.string().optional(),
        githubUrl: z.string().optional(),
        githubBranch: z.string().optional(),
        githubSubpath: z.string().optional(),
        requestedStages: z.array(z.string()).default(DEFAULT_STAGES),
        compilerProfile: z.object({ version: z.string().max(64).optional(), settings: z.record(z.string(), z.unknown()).optional() }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const access = input.projectId ? await getProjectAccess(ctx.user.id, input.projectId) : undefined;
        const selected = input.projectId
          ? { project: access?.project }
          : await getOrCreateWorkspaceProject(ctx.user.id);
        const project = selected.project;
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
        if (input.projectId && access && !["owner", "maintainer"].includes(access.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Maintainer access is required to start scans." });
        if (!project.defaultProfileId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Analysis profile is not configured." });
        const projectAccess = await getProjectAccess(ctx.user.id, project.id);
        if (!projectAccess) throw new TRPCError({ code: "FORBIDDEN", message: "Project access denied." });

        let files = input.files.map(file => ({ path: file.path, content: file.content }));
        let revisionLabel = input.revisionLabel;
        let sourceKind = input.sourceKind;

        if (input.githubUrl) {
          try {
            const fetched = await fetchGitHubRepoFiles({
              url: input.githubUrl,
              branch: input.githubBranch,
              subpath: input.githubSubpath,
            });
            files = fetched.files;
            revisionLabel = fetched.revisionLabel;
            sourceKind = "repository";
          } catch (error) {
            if (error instanceof TRPCError) throw error;
            throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Failed to fetch GitHub repository." });
          }
        } else if (input.archiveBase64) {
          try {
            const buffer = Buffer.from(input.archiveBase64, "base64");
            const extracted = await extractZipSafely(buffer);
            files.push(...extracted);
          } catch (error) {
             throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Failed to extract ZIP archive." });
          }
        }

        try {
          if (files.length === 0) throw new Error("No files provided.");
          files.forEach(file => assertSafeSourcePath(file.path));
          assertNoPrivateMaterial(files);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error && error.message.startsWith("SOURCE_SECRET_REJECTED") ? "Source upload rejected: private material or secrets must not be uploaded." : "Source path or upload content rejected." });
        }
        const manifest = manifestForFiles(files, revisionLabel, sourceKind);
        const artifactKey = await persistSourceBundle(ctx.user.id, project.id, files, manifest);
        const run = await createQueuedRun({
          projectId: project.id,
          requestedBy: ctx.user.id,
          idempotencyKey: input.idempotencyKey,
          sourceKind,
          revisionLabel,
          contentHash: manifest.contentHash,
          manifestJson: manifest,
          artifactKey,
          profileId: project.defaultProfileId,
        });
        if (!run) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create the scan run." });
        if (run.status === "completed" || run.status === "partial") return { run, reused: true };

        await appendAuditEvent({ workspaceId: projectAccess.workspace.id, actorId: ctx.user.id, action: "scan.created", targetType: "analysisRun", targetId: String(run.id), metadataJson: { sourceKind: input.sourceKind, revisionLabel: input.revisionLabel, stages: input.requestedStages } });
        const accepted = enqueueAnalysis({
          runId: run.id,
          userId: ctx.user.id,
          workspaceId: projectAccess.workspace.id,
          projectId: project.id,
          projectName: project.name,
          createdBy: ctx.user.id,
          chain: project.chain,
          revision: { revisionLabel: input.revisionLabel, contentHash: manifest.contentHash, compilerProfile: input.compilerProfile },
          files,
          requestedStages: input.requestedStages,
        });
        if (!accepted) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "The scan queue is full. Retry shortly." });
        return { runId: run.id, status: "queued" as const, queue: queueHealth(), reused: false };
      }),

    run: protectedProcedure
      .input(z.object({ runId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => getRunFindings(ctx.user.id, input.runId)),

    latestRun: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const latest = await getLatestRunForUser(ctx.user.id, input?.projectId);
        if (!latest) return null;
        return getRunFindings(ctx.user.id, latest.run.id);
      }),

    explainFinding: protectedProcedure
      .input(z.object({ findingId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const detail = await getFindingDetail(ctx.user.id, input.findingId);
        if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Finding not found." });
        const analysis = await analyzeFindingWithAi({
          finding: {
            title: detail.finding.title,
            description: detail.finding.description,
            category: detail.finding.category,
            severity: detail.finding.severity,
            confidence: detail.finding.confidence,
          },
          occurrences: detail.occurrences,
          evidence: detail.evidence.map(item => ({ evidenceHash: item.evidenceHash, payloadJson: item.payloadJson, provenanceJson: item.provenanceJson })),
        });
        await saveFindingAiAnalysis(input.findingId, analysis);
        await appendAuditEvent({ workspaceId: detail.project.workspaceId, actorId: ctx.user.id, action: "finding.ai_explanation_requested", targetType: "finding", targetId: String(input.findingId), metadataJson: { reviewStatus: analysis.reviewStatus, confidence: analysis.confidence } });
        return analysis;
      }),

    reviewFinding: protectedProcedure
      .input(z.object({ findingId: z.number().int().positive(), decision: z.enum(["confirm", "false_positive", "accepted_risk", "needs_retest", "reopen"]), rationale: z.string().min(3).max(4000) }))
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await reviewFinding({ userId: ctx.user.id, ...input });
          if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Finding not found." });
          const detail = await getFindingDetail(ctx.user.id, input.findingId);
          if (detail) await appendAuditEvent({ workspaceId: detail.project.workspaceId, actorId: ctx.user.id, action: `finding.review.${input.decision}`, targetType: "finding", targetId: String(input.findingId), metadataJson: { rationaleLength: input.rationale.length } });
          return result;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          if (error instanceof Error && error.message === "REVIEWER_ACCESS_REQUIRED") throw new TRPCError({ code: "FORBIDDEN", message: "Reviewer access is required." });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not save the finding review." });
        }
      }),

    report: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => getLatestReport(ctx.user.id, input.projectId)),

    verifyReport: protectedProcedure
      .input(z.object({ contentJson: z.unknown(), expectedHash: z.string().length(64) }))
      .mutation(({ input }) => ({ valid: verifyReportHash(input.contentJson, input.expectedHash), statement: "A valid hash proves report integrity, not contract security." })),

    anchorReport: protectedProcedure
      .input(z.object({ reportId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        // Look up the report directly by reportId
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const { reports } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const reportRows = await db.select().from(reports).where(eq(reports.id, input.reportId)).limit(1);
        const report = reportRows[0];
        if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found." });

        // Verify user has owner/maintainer access to this report's project
        const access = await getProjectAccess(ctx.user.id, report.projectId);
        if (!access || !["owner", "maintainer"].includes(access.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only owners and maintainers can anchor reports." });
        }

        try {
          const result = await anchorReportOnChain(report.contentHash);
          await saveReportAnchor({ reportId: input.reportId, network: "sepolia", payloadHash: report.contentHash, txHash: result.txHash });
          await appendAuditEvent({ workspaceId: access.workspace.id, actorId: ctx.user.id, action: "report.anchored", targetType: "report", targetId: String(input.reportId), metadataJson: { txHash: result.txHash, network: "sepolia" } });
          return result;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Anchoring failed." });
        }
      }),

    reportAnchor: protectedProcedure
      .input(z.object({ reportId: z.number().int().positive() }))
      .query(async ({ input }) => getReportAnchor(input.reportId)),
  }),
});

export type AppRouter = typeof appRouter;

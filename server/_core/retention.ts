import { inArray, lt } from "drizzle-orm";
import { getDb } from "../db";
import {
  analysisRuns,
  findingReviews,
  findingOccurrences,
  findingRecords,
  testExecutions,
  evidenceItems,
  artifacts,
  runStages,
  reports
} from "../../drizzle/schema";
import { retentionPurgedTotal } from "./metrics";

export async function purgeOldRuns(daysOld = 30) {
  const db = await getDb();
  if (!db) {
    console.warn("[Retention] Database not available, skipping retention job.");
    return 0;
  }
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  // Find old runs
  const oldRuns = await db.select({ id: analysisRuns.id }).from(analysisRuns).where(lt(analysisRuns.createdAt, cutoffDate));
  const runIds = oldRuns.map((r: { id: number }) => r.id);

  if (runIds.length === 0) {
    console.log(`[Retention] No runs older than ${daysOld} days found.`);
    return 0;
  }

  console.log(`[Retention] Found ${runIds.length} old runs. Starting purge...`);

  // Chunk to avoid exceeding MySQL IN clause limits
  const chunkSize = 100;
  let purgedCount = 0;

  for (let i = 0; i < runIds.length; i += chunkSize) {
    const chunkIds = runIds.slice(i, i + chunkSize);
    
    // We must find finding IDs to delete findingReviews because findingReviews only has findingId, not runId.
    const findings = await db.select({ id: findingRecords.id }).from(findingRecords).where(inArray(findingRecords.runId, chunkIds));
    const findingIds = findings.map((f: { id: number }) => f.id);

    // Delete in reverse dependency order
    if (findingIds.length > 0) {
      // Chunk findingIds as well, just to be safe
      for (let j = 0; j < findingIds.length; j += chunkSize) {
        await db.delete(findingReviews).where(inArray(findingReviews.findingId, findingIds.slice(j, j + chunkSize)));
      }
    }

    await db.delete(findingOccurrences).where(inArray(findingOccurrences.runId, chunkIds));
    await db.delete(findingRecords).where(inArray(findingRecords.runId, chunkIds));
    await db.delete(testExecutions).where(inArray(testExecutions.runId, chunkIds));
    await db.delete(evidenceItems).where(inArray(evidenceItems.runId, chunkIds));
    await db.delete(artifacts).where(inArray(artifacts.runId, chunkIds));
    await db.delete(runStages).where(inArray(runStages.runId, chunkIds));
    await db.delete(reports).where(inArray(reports.runId, chunkIds));

    // Finally delete the runs themselves
    await db.delete(analysisRuns).where(inArray(analysisRuns.id, chunkIds));
    
    purgedCount += chunkIds.length;
  }

  if (purgedCount > 0) {
    retentionPurgedTotal.inc(purgedCount);
  }

  console.log(`[Retention] Purged ${purgedCount} runs successfully.`);
  return purgedCount;
}

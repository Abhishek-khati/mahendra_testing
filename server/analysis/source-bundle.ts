import { storagePut } from "../storage";
import type { SourceFile, SourceManifest } from "./contracts";

export async function persistSourceBundle(userId: number, projectId: number, files: SourceFile[], manifest: SourceManifest) {
  if (!process.env.BUILT_IN_FORGE_API_KEY) return undefined;
  try {
    const payload = JSON.stringify({ manifest, files });
    const stored = await storagePut(`chainshield/${userId}/${projectId}/${manifest.contentHash}.json`, payload, "application/json");
    return stored.key;
  } catch {
    return undefined;
  }
}

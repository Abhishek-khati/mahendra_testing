import { sha256 } from "./evidence";

export function verifyReportHash(contentJson: unknown, expectedHash: string) {
  return sha256(JSON.stringify(contentJson)) === expectedHash;
}

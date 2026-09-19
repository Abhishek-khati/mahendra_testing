import { createHash } from "node:crypto";
import type { EvidenceSlice, SourceFile } from "./contracts";

export const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

export function lineNumberAtOffset(content: string, offset: number): number {
  return content.slice(0, Math.max(0, offset)).split("\n").length;
}

export function lineRange(content: string, startLine: number, endLine: number): string {
  return content
    .split("\n")
    .slice(Math.max(0, startLine - 1), Math.max(startLine, endLine))
    .join("\n");
}

export function evidenceForMatch(
  file: SourceFile,
  matchIndex: number,
  source: EvidenceSlice["source"],
  ruleId: string,
  contextLines = 2,
  limitations: string[] = [],
): EvidenceSlice {
  const lines = file.content.split("\n");
  const matchedLine = lineNumberAtOffset(file.content, matchIndex);
  const startLine = Math.max(1, matchedLine - contextLines);
  const endLine = Math.min(lines.length, matchedLine + contextLines);
  const snippet = lineRange(file.content, startLine, endLine);
  return {
    evidenceId: `${sha256(`${file.path}:${startLine}:${endLine}:${ruleId}`)}`.slice(0, 24),
    filePath: file.path,
    startLine,
    endLine,
    snippet,
    codeHash: sha256(snippet),
    source,
    extractorVersion: "evidence-extractor/1.0.0",
    limitations,
  };
}

export function manifestForFiles(files: SourceFile[], revisionLabel: string, sourceKind: "upload" | "repository" | "fixture") {
  const normalized = files.map(file => ({
    path: file.path,
    sha256: file.sha256 ?? sha256(file.content),
    bytes: Buffer.byteLength(file.content, "utf8"),
  }));
  return {
    revisionLabel,
    sourceKind,
    contentHash: sha256(normalized.map(item => `${item.path}:${item.sha256}`).join("\n")),
    files: normalized,
  };
}

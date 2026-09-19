import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { FindingCandidate, SourceFile, WorkerStageRequest, WorkerStageResult } from "./contracts";
import { evidenceForMatch } from "./evidence";

const WORKER_VERSION = "isolated-worker/1.0.0";
const MAX_STDOUT = 8 * 1024 * 1024;

function runCommand(command: string, args: string[], cwd: string, input?: string, timeoutMs = 60_000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      env: { PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin", HOME: "/tmp" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let overflow = false;
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      if (Buffer.byteLength(stdout) + chunk.byteLength > MAX_STDOUT) {
        overflow = true;
        child.kill("SIGKILL");
        return;
      }
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (Buffer.byteLength(stderr) < MAX_STDOUT) stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", code => {
      clearTimeout(timer);
      if (overflow) return reject(new Error("WORKER_OUTPUT_LIMIT"));
      resolve({ code: code ?? -1, stdout, stderr });
    });
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

function result(request: WorkerStageRequest, status: WorkerStageResult["status"], errorCode: string | undefined, limitations: string[], findings: FindingCandidate[] = [], evidence: WorkerStageResult["evidence"] = [], toolMetadata: Record<string, string> = {}): WorkerStageResult {
  return {
    requestId: request.requestId,
    stage: request.stage,
    status,
    workerVersion: WORKER_VERSION,
    errorCode,
    limitations,
    findings,
    evidence,
    toolMetadata,
  };
}

async function compileSolidity(request: WorkerStageRequest, files: SourceFile[], cwd: string): Promise<WorkerStageResult> {
  const sources = Object.fromEntries(files.map(file => [file.path, { content: file.content }]));
  const standardJson = JSON.stringify({ language: "Solidity", sources, settings: request.sourceRevision.compilerProfile?.settings ?? { outputSelection: { "*": { "": ["ast"] } } } });
  try {
    const output = await runCommand("solc", ["--standard-json"], cwd, standardJson, request.policy.timeoutMs);
    const parsed = JSON.parse(output.stdout) as { errors?: Array<{ severity?: string; message?: string; sourceLocation?: { file?: string; start?: number; end?: number } }> };
    const findings: FindingCandidate[] = [];
    const evidence: WorkerStageResult["evidence"] = [];
    for (const diagnostic of parsed.errors ?? []) {
      const file = files.find(item => item.path === diagnostic.sourceLocation?.file);
      const start = diagnostic.sourceLocation?.start ?? 0;
      if (!file || diagnostic.severity === "info") continue;
      const slice = evidenceForMatch(file, start, "compiler", "solc-diagnostic", 1, ["Compiler diagnostic only; no exploitability conclusion."]);
      evidence.push(slice);
      findings.push({
        title: diagnostic.severity === "error" ? "Solidity compilation error" : "Solidity compiler warning",
        category: "Compilation",
        classification: diagnostic.severity === "error" ? "warning" : "informational",
        severity: diagnostic.severity === "error" ? "high" : "low",
        confidence: "high",
        description: diagnostic.message ?? "Compiler diagnostic returned without a message.",
        detector: { engine: "solc", ruleId: "solc-diagnostic", version: request.sourceRevision.compilerProfile?.version ?? "unknown" },
        evidence: [slice],
        limitations: ["This is a compiler diagnostic, not a vulnerability determination."],
      });
    }
    return result(request, output.code === 0 ? "succeeded" : "failed", output.code === 0 ? undefined : "SOLC_EXIT_NONZERO", [], findings, evidence, { solc: request.sourceRevision.compilerProfile?.version ?? "unknown" });
  } catch (error) {
    return result(request, "failed", error instanceof Error ? error.message : "SOLC_EXECUTION_FAILED", ["The worker could not execute solc or parse its output."], [], [], { solc: "execution-failed" });
  }
}

async function runSlither(request: WorkerStageRequest, files: SourceFile[], cwd: string): Promise<WorkerStageResult> {
  try {
    const output = await runCommand("slither", [cwd, "--json", "-"], cwd, undefined, request.policy.timeoutMs);
    let parsed: { results?: { detectors?: Array<{ check?: string; impact?: string; confidence?: string; description?: string; elements?: Array<{ source_mapping?: { filename_relative?: string; lines?: number[] } }> }> } } = {};
    try { parsed = JSON.parse(output.stdout) as typeof parsed; } catch { /* Slither may write diagnostics to stderr. */ }
    const findings: FindingCandidate[] = [];
    const evidence: WorkerStageResult["evidence"] = [];
    for (const detector of parsed.results?.detectors ?? []) {
      const element = detector.elements?.[0];
      const file = files.find(item => item.path.endsWith(element?.source_mapping?.filename_relative ?? "__missing__"));
      const line = element?.source_mapping?.lines?.[0] ?? 1;
      if (!file) continue;
      const slice = evidenceForMatch(file, file.content.split("\n").slice(0, line - 1).join("\n").length, "slither", detector.check ?? "slither-detector", 2, ["Slither output is normalized but still requires human validation and behavioral confirmation."]);
      evidence.push(slice);
      findings.push({
        title: detector.check ?? "Slither detector finding",
        category: "Static analysis",
        classification: "vulnerability",
        severity: /high|critical/i.test(detector.impact ?? "") ? "high" : /medium/i.test(detector.impact ?? "") ? "medium" : "low",
        confidence: /high/i.test(detector.confidence ?? "") ? "high" : /medium/i.test(detector.confidence ?? "") ? "medium" : "low",
        description: detector.description ?? "Slither detector returned a finding without a description.",
        detector: { engine: "slither", ruleId: detector.check ?? "slither-detector", version: "unknown" },
        evidence: [slice],
        limitations: ["Static analysis does not establish exploitability or economic impact on its own."],
      });
    }
    return result(request, output.code === 0 ? "succeeded" : "failed", output.code === 0 ? undefined : "SLITHER_EXIT_NONZERO", ["Slither must run in the isolated worker with network access disabled."], findings, evidence, { slither: "worker-resolved" });
  } catch (error) {
    return result(request, "failed", error instanceof Error ? error.message : "SLITHER_EXECUTION_FAILED", ["The worker could not execute Slither or parse its output."], [], [], { slither: "execution-failed" });
  }
}

export async function executeWorkerStage(request: WorkerStageRequest, files: SourceFile[]): Promise<WorkerStageResult> {
  const cwd = await mkdtemp(join(tmpdir(), `chainshield-${randomUUID()}-`));
  try {
    for (const file of files) {
      if (file.path.startsWith("/") || file.path.includes("..") || file.path.includes("\\")) throw new Error("WORKER_PATH_REJECTED");
      const target = join(cwd, file.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.content, { encoding: "utf8" });
    }
    if (request.stage === "solidity-compile") return compileSolidity(request, files, cwd);
    if (request.stage === "slither") return runSlither(request, files, cwd);
    return result(request, "unsupported", "BEHAVIORAL_RUNNER_NOT_CONFIGURED", ["Behavioral testing requires a separately provisioned test runner with explicit harness allowlists."]);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

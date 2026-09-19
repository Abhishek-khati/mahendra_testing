import { TRPCError } from "@trpc/server";
import axios from "axios";
import { assertNoPrivateMaterial, assertSafeSourcePath } from "../security";

const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10 MiB
const MAX_FILE_SIZE = 750 * 1024; // 750 KiB
const MAX_FILES = 100;

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  branch?: string;
  subpath?: string;
}

export function parseGitHubUrl(input: string): ParsedGitHubUrl {
  const trimmed = input.trim();
  let url = trimmed;

  // Handle shorthand "owner/repo"
  if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    const [owner, repo] = trimmed.split("/");
    return { owner, repo: repo.replace(/\.git$/, "") };
  }

  // Remove protocol and domain if present
  let pathStr = url.replace(/^https?:\/\/(www\.)?github\.com\//i, "");
  pathStr = pathStr.replace(/\.git$/, "");

  const parts = pathStr.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid GitHub URL format. Expected https://github.com/owner/repo",
    });
  }

  const owner = parts[0];
  const repo = parts[1];

  // Check for /tree/{branch}/{subpath...}
  if (parts.length >= 4 && parts[2] === "tree") {
    const branch = parts[3];
    const subpath = parts.slice(4).join("/");
    return { owner, repo, branch, subpath: subpath || undefined };
  }

  return { owner, repo };
}

export interface GitHubFile {
  path: string;
  content: string;
  size: number;
}

export async function fetchGitHubRepoFiles(input: {
  url: string;
  branch?: string;
  subpath?: string;
}): Promise<{
  files: Array<{ path: string; content: string }>;
  owner: string;
  repo: string;
  branch: string;
  revisionLabel: string;
}> {
  const parsed = parseGitHubUrl(input.url);
  const owner = parsed.owner;
  const repo = parsed.repo;
  let branch = input.branch || parsed.branch;
  const subpath = input.subpath || parsed.subpath;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "ChainShield-AI-Auditor",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  }

  // If no branch specified, get default branch
  if (!branch) {
    try {
      const repoRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
        headers,
        timeout: 10000,
      });
      branch = repoRes.data.default_branch || "main";
    } catch (error) {
      // Fallback to "main"
      branch = "main";
    }
  }

  // Fetch full tree recursively
  let tree: Array<{ path: string; type: string; size?: number; url?: string }> = [];
  try {
    const treeRes = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      { headers, timeout: 15000 }
    );
    tree = treeRes.data.tree || [];
  } catch (err: any) {
    if (branch === "main") {
      // Try fallback to "master"
      try {
        const fallbackRes = await axios.get(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`,
          { headers, timeout: 15000 }
        );
        tree = fallbackRes.data.tree || [];
        branch = "master";
      } catch {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Could not access GitHub repository ${owner}/${repo} on branch '${branch}'. Ensure it is public or provide a valid branch.`,
        });
      }
    } else {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Could not access GitHub repository ${owner}/${repo} on branch '${branch}'.`,
      });
    }
  }

  // Filter relevant smart contract files
  const relevantExtensions = [".sol", ".json", ".toml"];
  const candidateFiles = tree.filter((item) => {
    if (item.type !== "blob") return false;
    if (subpath && !item.path.startsWith(subpath)) return false;
    return relevantExtensions.some((ext) => item.path.endsWith(ext));
  });

  if (candidateFiles.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `No Solidity contracts (.sol) found in repository ${owner}/${repo}${subpath ? ` under path '${subpath}'` : ""}.`,
    });
  }

  if (candidateFiles.length > MAX_FILES) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: `Repository contains ${candidateFiles.length} contracts/config files, exceeding the max limit of ${MAX_FILES} files. Use the subpath option to target specific contract directories.`,
    });
  }

  // Download files
  const files: Array<{ path: string; content: string }> = [];
  let totalBytes = 0;

  for (const candidate of candidateFiles) {
    try {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${candidate.path}`;
      const fileRes = await axios.get(rawUrl, {
        responseType: "text",
        timeout: 10000,
        maxContentLength: MAX_FILE_SIZE,
      });

      const content = String(fileRes.data);
      const byteLen = Buffer.byteLength(content, "utf8");

      if (byteLen > MAX_FILE_SIZE) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: `File ${candidate.path} exceeds max size of ${MAX_FILE_SIZE / 1024} KiB.`,
        });
      }

      totalBytes += byteLen;
      if (totalBytes > MAX_TOTAL_SIZE) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Total repository contract bundle exceeds 10 MiB limit.",
        });
      }

      assertSafeSourcePath(candidate.path);
      files.push({ path: candidate.path, content });
    } catch (fetchErr: any) {
      if (fetchErr instanceof TRPCError) throw fetchErr;
      console.warn(`[GitHub Ingest] Failed to fetch ${candidate.path}:`, fetchErr.message);
    }
  }

  if (files.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Could not download any contract source files from repository.",
    });
  }

  assertNoPrivateMaterial(files);

  const revisionLabel = `github:${owner}/${repo}@${branch}`;

  return {
    files,
    owner,
    repo,
    branch: branch!,
    revisionLabel,
  };
}

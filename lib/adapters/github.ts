import { z } from "zod";
import {
  githubEvidenceSchema,
  type AuditScope,
  type GitHubEvidence,
} from "../evidence/schemas";
import { fetchJson } from "../http";

const commitSchema = z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/i) }).passthrough();
const contentSchema = z.object({
  type: z.literal("file"),
  sha: z.string(),
  content: z.string(),
  encoding: z.literal("base64"),
  html_url: z.string().url(),
}).passthrough();

export function normalizeGitHubRepository(value: string): {
  url: string;
  owner: string;
  repository: string;
} | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") return null;
    const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const repository = parts[1].replace(/\.git$/i, "");
    if (!/^[\w.-]+$/.test(parts[0]) || !/^[\w.-]+$/.test(repository)) return null;
    return { url: `https://github.com/${parts[0]}/${repository}`, owner: parts[0], repository };
  } catch {
    return null;
  }
}

function headers(): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "AuditScope",
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  };
}

function encodePath(path: string): string | null {
  const parts = path.replace(/^\/+/, "").split("/");
  if (!parts.length || parts.some((part) => !part || part === "." || part === "..")) return null;
  return parts.map(encodeURIComponent).join("/");
}

export async function lookupGitHubEvidence(scope: AuditScope): Promise<GitHubEvidence> {
  const rawUrl = scope.repositoryUrl.value;
  const normalized = rawUrl ? normalizeGitHubRepository(rawUrl) : null;
  const requestedRef = scope.commitSha.value ?? scope.tag.value;
  const empty = (error: string): GitHubEvidence => githubEvidenceSchema.parse({
    repositoryUrl: normalized?.url ?? null,
    owner: normalized?.owner ?? null,
    repository: normalized?.repository ?? null,
    requestedRef,
    resolvedSha: null,
    commitVerified: false,
    files: [],
    error,
  });

  if (!normalized) return empty(rawUrl ? "The audit repository URL is not a supported GitHub URL" : "The audit does not identify a repository");
  if (!requestedRef) return empty("The audit does not identify a commit or tag");

  const apiBase = `https://api.github.com/repos/${encodeURIComponent(normalized.owner)}/${encodeURIComponent(normalized.repository)}`;
  try {
    const commit = await fetchJson({
      service: "GitHub",
      url: `${apiBase}/commits/${encodeURIComponent(requestedRef)}`,
      schema: commitSchema,
      headers: headers(),
      notFoundAsNull: true,
    });
    if (!commit) return empty("GitHub could not resolve the audit commit or tag");

    const files = [];
    for (const source of scope.sourceFiles.slice(0, 20)) {
      const path = encodePath(source.path);
      if (!path) continue;
      const file = await fetchJson({
        service: "GitHub",
        url: `${apiBase}/contents/${path}?ref=${commit.sha}`,
        schema: contentSchema,
        headers: headers(),
        notFoundAsNull: true,
      });
      if (file) {
        files.push({
          path: source.path,
          content: Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8"),
          blobSha: file.sha,
          url: file.html_url,
        });
      }
    }

    return githubEvidenceSchema.parse({
      repositoryUrl: normalized.url,
      owner: normalized.owner,
      repository: normalized.repository,
      requestedRef,
      resolvedSha: commit.sha,
      commitVerified: true,
      files,
      error: scope.sourceFiles.length > 0 && files.length === 0
        ? "The audited source files were not found at the resolved commit"
        : null,
    });
  } catch (error) {
    return empty(error instanceof Error ? error.message : "GitHub lookup failed");
  }
}

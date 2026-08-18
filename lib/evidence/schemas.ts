import { z } from "zod";

export const evidenceCitationSchema = z.object({
  page: z.number().int().positive().nullable(),
  excerpt: z.string().min(1),
});

const extractedString = z.object({
  value: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  evidence: z.array(evidenceCitationSchema),
});

const extractedStrings = z.object({
  value: z.array(z.string()).nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  evidence: z.array(evidenceCitationSchema),
});

export const auditScopeSchema = z.object({
  auditor: extractedString,
  title: extractedString,
  auditDate: extractedString,
  repositoryUrl: extractedString,
  commitSha: extractedString,
  tag: extractedString,
  contractAddresses: extractedStrings,
  implementationAddresses: extractedStrings,
  sourceFiles: z.array(z.object({
    path: z.string(),
    contractName: z.string().nullable(),
    evidence: z.array(evidenceCitationSchema),
  })),
  exclusions: z.array(z.object({
    text: z.string(),
    evidence: z.array(evidenceCitationSchema),
  })),
  uncertainties: z.array(z.string()),
});

export type AuditScope = z.infer<typeof auditScopeSchema>;

export const verdictSchema = z.enum(["CURRENT", "PARTIAL", "STALE", "UNVERIFIED"]);
export type CoverageVerdict = z.infer<typeof verdictSchema>;

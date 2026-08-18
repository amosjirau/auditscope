import { z } from "zod";

export const evmAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Enter a valid EVM contract address");

export const chainIdSchema = z.union([z.literal(8453), z.literal(84532)]);
export type SupportedChainId = z.infer<typeof chainIdSchema>;

export const evidenceCitationSchema = z.object({
  page: z.number().int().positive().nullable(),
  excerpt: z.string().min(1),
}).strict();

const extractedString = z.object({
  value: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  evidence: z.array(evidenceCitationSchema),
}).strict().superRefine((field, context) => {
  if (field.value !== null && field.evidence.length === 0) {
    context.addIssue({ code: "custom", path: ["evidence"], message: "Extracted values require a PDF citation" });
  }
});

const extractedAddresses = z.object({
  value: z.array(evmAddressSchema).nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  evidence: z.array(evidenceCitationSchema),
}).strict().superRefine((field, context) => {
  if (field.value !== null && field.value.length > 0 && field.evidence.length === 0) {
    context.addIssue({ code: "custom", path: ["evidence"], message: "Extracted addresses require a PDF citation" });
  }
});

export const auditScopeSchema = z.object({
  auditor: extractedString,
  title: extractedString,
  auditDate: extractedString,
  repositoryUrl: extractedString,
  commitSha: extractedString,
  tag: extractedString,
  contractAddresses: extractedAddresses,
  implementationAddresses: extractedAddresses,
  sourceFiles: z.array(z.object({
    path: z.string().min(1),
    contractName: z.string().nullable(),
    evidence: z.array(evidenceCitationSchema).min(1),
  }).strict()),
  exclusions: z.array(z.object({
    text: z.string().min(1),
    evidence: z.array(evidenceCitationSchema).min(1),
  }).strict()),
  uncertainties: z.array(z.string()),
}).strict();

export type AuditScope = z.infer<typeof auditScopeSchema>;

export const verdictSchema = z.enum(["CURRENT", "PARTIAL", "STALE", "UNVERIFIED"]);
export type CoverageVerdict = z.infer<typeof verdictSchema>;

export const investigationStageSchema = z.object({
  id: z.enum(["audit", "github", "deployment", "implementation", "comparison"]),
  label: z.string(),
  status: z.enum(["complete", "warning", "failed"]),
  detail: z.string(),
}).strict();

export const evidenceItemSchema = z.object({
  id: z.string(),
  source: z.enum(["audit", "github", "sourcify", "rpc", "system"]),
  label: z.string(),
  status: z.enum(["match", "mismatch", "observed", "unknown", "error"]),
  strength: z.enum(["strong", "weak"]),
  detail: z.string(),
  url: z.string().url().nullable(),
}).strict();

export const verifiedSourceSchema = z.object({
  path: z.string(),
  content: z.string(),
  contentHash: z.string(),
}).strict();

export const deploymentEvidenceSchema = z.object({
  chainId: chainIdSchema,
  requestedAddress: evmAddressSchema,
  hasCode: z.boolean(),
  verificationStatus: z.enum(["verified", "unverified", "error"]),
  match: z.enum(["exact_match", "match"]).nullable(),
  contractName: z.string().nullable(),
  isProxy: z.boolean(),
  proxyType: z.string().nullable(),
  implementationAddress: evmAddressSchema.nullable(),
  proxyResolutionSource: z.enum(["sourcify", "eip1967", "none"]),
  sources: z.array(verifiedSourceSchema),
  error: z.string().nullable(),
}).strict();
export type DeploymentEvidence = z.infer<typeof deploymentEvidenceSchema>;

export const githubFileEvidenceSchema = z.object({
  path: z.string(),
  content: z.string(),
  blobSha: z.string(),
  url: z.string().url(),
}).strict();

export const githubEvidenceSchema = z.object({
  repositoryUrl: z.string().url().nullable(),
  owner: z.string().nullable(),
  repository: z.string().nullable(),
  requestedRef: z.string().nullable(),
  resolvedSha: z.string().nullable(),
  commitVerified: z.boolean(),
  files: z.array(githubFileEvidenceSchema),
  error: z.string().nullable(),
}).strict();
export type GitHubEvidence = z.infer<typeof githubEvidenceSchema>;

export const componentResultSchema = z.object({
  id: z.string(),
  label: z.string(),
  critical: z.boolean(),
  coverage: z.enum(["covered", "mismatch", "unresolved"]),
  decisive: z.boolean(),
  detail: z.string(),
  auditValue: z.string().nullable(),
  liveValue: z.string().nullable(),
}).strict();
export type ComponentResult = z.infer<typeof componentResultSchema>;

export const verificationResultSchema = z.object({
  verdict: verdictSchema,
  confidence: z.enum(["high", "medium", "low"]),
  reason: z.string(),
  auditScope: auditScopeSchema,
  deployment: deploymentEvidenceSchema,
  implementation: deploymentEvidenceSchema.nullable(),
  github: githubEvidenceSchema,
  components: z.array(componentResultSchema),
  evidence: z.array(evidenceItemSchema),
  stages: z.array(investigationStageSchema),
  limitations: z.array(z.string()),
}).strict();
export type VerificationResult = z.infer<typeof verificationResultSchema>;

export type {
  AuditScope,
  ComponentResult,
  DeploymentEvidence,
  GitHubEvidence,
} from "./schemas";
import type { z } from "zod";
import { evidenceItemSchema } from "./schemas";

export type EvidenceItem = z.infer<typeof evidenceItemSchema>;

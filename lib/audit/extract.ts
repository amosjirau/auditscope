import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { auditScopeSchema, type AuditScope } from "../evidence/schemas";

const EXTRACTION_PROMPT = `Extract the security audit scope from this PDF.

Rules:
- Copy only facts explicitly supported by the PDF.
- Never infer or invent repository URLs, commits, tags, addresses, filenames, dates, or contract names.
- Use null for an absent scalar and null for an absent list value.
- Every critical value must cite the PDF page and a short exact excerpt.
- Record ambiguity in uncertainties.
- Repository URLs must be the URL printed in the report, without silently changing it.
- Set addressIsScopeBoundary to true only when the report explicitly says coverage is limited to the listed deployment or implementation address. Set it to false only when the report explicitly allows equivalent redeployments; otherwise use null. Cite the exact statement.
- Do not assess current deployment coverage and do not output a coverage verdict.`;

const MAX_EXTRACTION_ATTEMPTS = 3;
const EXTRACTION_BUDGET_MS = 260_000;
const MODEL_ATTEMPT_TIMEOUT_MS = 120_000;
const RETRY_DELAYS_MS = [15_000, 30_000, 60_000] as const;

type AuditExtractionErrorCode =
  | "INVALID_REQUEST"
  | "SERVER_CONFIGURATION"
  | "GEMINI_QUOTA"
  | "GEMINI_RATE_LIMIT"
  | "GEMINI_TIMEOUT"
  | "GEMINI_INVALID_OUTPUT"
  | "GEMINI_UNAVAILABLE";

type ClassifiedExtractionFailure = {
  code: AuditExtractionErrorCode;
  message: string;
  suggestion: string;
  retryable: boolean;
};

function retryDelayMs(error: unknown, attempt: number): number {
  const message = error instanceof Error ? error.message : String(error);
  const providerDelay = message.match(/Please retry in ([0-9.]+)s/i)?.[1];
  if (providerDelay) return Math.min(Math.ceil(Number(providerDelay) * 1_000) + 1_000, 120_000);
  return RETRY_DELAYS_MS[attempt - 1];
}

export class AuditExtractionError extends Error {
  constructor(
    public readonly code: AuditExtractionErrorCode,
    message: string,
    public readonly suggestion: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "AuditExtractionError";
  }
}

export function classifyGeminiFailure(error: unknown): ClassifiedExtractionFailure {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes("free_tier_requests") || normalized.includes("request quota") || normalized.includes("quota exceeded")) {
    return {
      code: "GEMINI_QUOTA",
      message: "Gemini did not run because the configured Google project has exhausted its request quota.",
      suggestion: "Check the project billing and quota in Google AI Studio, then retry after the provider resets the quota.",
      retryable: false,
    };
  }
  if (normalized.includes("rate limit") || normalized.includes("resource_exhausted") || normalized.includes("http 429")) {
    return {
      code: "GEMINI_RATE_LIMIT",
      message: "Gemini is temporarily rate-limiting audit extraction.",
      suggestion: "Wait for the provider retry window, then run the same verification again. AuditScope did not produce or cache a verdict.",
      retryable: true,
    };
  }
  if (normalized.includes("abort") || normalized.includes("timeout") || normalized.includes("timed out")) {
    return {
      code: "GEMINI_TIMEOUT",
      message: "Gemini did not finish reading this PDF within the production time limit.",
      suggestion: "Try a smaller, text-searchable PDF or configure a faster Gemini model explicitly. No verdict was produced.",
      retryable: true,
    };
  }
  if (normalized.includes("no object generated") || normalized.includes("did not match schema") || normalized.includes("invalid output")) {
    return {
      code: "GEMINI_INVALID_OUTPUT",
      message: "Gemini responded, but the extracted audit scope did not pass AuditScope's schema.",
      suggestion: "Retry the extraction. AuditScope rejected the model output and produced no verdict.",
      retryable: true,
    };
  }
  return {
    code: "GEMINI_UNAVAILABLE",
    message: "Gemini could not complete audit extraction.",
    suggestion: "Retry after checking the configured model and Google service status. No verdict was produced.",
    retryable: true,
  };
}

export async function extractAuditScope(pdf: Uint8Array): Promise<AuditScope> {
  const header = new TextDecoder().decode(pdf.slice(0, 5));
  if (header !== "%PDF-") {
    throw new AuditExtractionError(
      "INVALID_REQUEST",
      "The uploaded file is not a valid PDF.",
      "Choose a PDF security report and try again.",
      false,
    );
  }
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new AuditExtractionError(
      "SERVER_CONFIGURATION",
      "Gemini is not configured on this AuditScope deployment.",
      "Set GOOGLE_GENERATIVE_AI_API_KEY as a server-only environment variable.",
      false,
    );
  }
  const model = process.env.GEMINI_MODEL?.trim();
  if (!model) {
    throw new AuditExtractionError(
      "SERVER_CONFIGURATION",
      "No Gemini model is configured on this AuditScope deployment.",
      "Set GEMINI_MODEL explicitly. AuditScope never silently switches models.",
      false,
    );
  }

  const deadline = Date.now() + EXTRACTION_BUDGET_MS;
  let lastError: unknown;
  let lastFailure: ClassifiedExtractionFailure | null = null;
  for (let attempt = 1; attempt <= MAX_EXTRACTION_ATTEMPTS; attempt += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs < 1_000) break;
    try {
      const result = await generateText({
        model: google(model),
        output: Output.object({ schema: auditScopeSchema }),
        messages: [{
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            { type: "file", data: pdf, mediaType: "application/pdf", filename: "audit.pdf" },
          ],
        }],
        abortSignal: AbortSignal.timeout(Math.min(MODEL_ATTEMPT_TIMEOUT_MS, remainingMs)),
      });
      return auditScopeSchema.parse(result.output);
    } catch (error) {
      lastError = error;
      lastFailure = classifyGeminiFailure(error);
      if (!lastFailure.retryable || attempt >= MAX_EXTRACTION_ATTEMPTS) break;
      const delayMs = retryDelayMs(error, attempt);
      if (Date.now() + delayMs >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const failure = lastFailure ?? classifyGeminiFailure(lastError);
  throw new AuditExtractionError(
    failure.code,
    failure.message,
    failure.suggestion,
    failure.retryable,
  );
}

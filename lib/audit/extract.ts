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

const MAX_EXTRACTION_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [15_000, 30_000, 60_000] as const;

function retryDelayMs(error: unknown, attempt: number): number {
  const message = error instanceof Error ? error.message : String(error);
  const providerDelay = message.match(/Please retry in ([0-9.]+)s/i)?.[1];
  if (providerDelay) return Math.min(Math.ceil(Number(providerDelay) * 1_000) + 1_000, 120_000);
  return RETRY_DELAYS_MS[attempt - 1];
}

export class AuditExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditExtractionError";
  }
}

export async function extractAuditScope(pdf: Uint8Array): Promise<AuditScope> {
  const header = new TextDecoder().decode(pdf.slice(0, 5));
  if (header !== "%PDF-") throw new AuditExtractionError("The uploaded file is not a valid PDF");
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new AuditExtractionError("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_EXTRACTION_ATTEMPTS; attempt += 1) {
    try {
      const result = await generateText({
        model: google(process.env.GEMINI_MODEL ?? "gemini-3.5-flash"),
        output: Output.object({ schema: auditScopeSchema }),
        messages: [{
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            { type: "file", data: pdf, mediaType: "application/pdf", filename: "audit.pdf" },
          ],
        }],
        abortSignal: AbortSignal.timeout(120_000),
      });
      return auditScopeSchema.parse(result.output);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_EXTRACTION_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs(error, attempt)));
      }
    }
  }

  throw new AuditExtractionError(
    `Gemini could not produce a validated audit scope after ${MAX_EXTRACTION_ATTEMPTS} attempts: ${lastError instanceof Error ? lastError.message : "unknown error"}`,
  );
}

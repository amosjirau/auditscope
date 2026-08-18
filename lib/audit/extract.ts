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
- Do not assess current deployment coverage and do not output a coverage verdict.`;

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

  try {
    const result = await generateText({
      model: google(process.env.GEMINI_MODEL ?? "gemini-2.5-flash"),
      output: Output.object({ schema: auditScopeSchema }),
      messages: [{
        role: "user",
        content: [
          { type: "text", text: EXTRACTION_PROMPT },
          { type: "file", data: pdf, mediaType: "application/pdf", filename: "audit.pdf" },
        ],
      }],
      abortSignal: AbortSignal.timeout(60_000),
    });
    return auditScopeSchema.parse(result.output);
  } catch (error) {
    if (error instanceof AuditExtractionError) throw error;
    throw new AuditExtractionError(
      `Gemini could not produce a validated audit scope: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

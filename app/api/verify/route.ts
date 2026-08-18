import { chainIdSchema, evmAddressSchema } from "@/lib/evidence/schemas";
import { missingServerVariables } from "@/lib/server/environment";
import { publicVerificationError, type PublicVerificationError } from "@/lib/verification/errors";
import { verifyAuditCoverage } from "@/lib/verification/pipeline";

export const maxDuration = 300;
const MAX_PDF_BYTES = 4 * 1024 * 1024;
const encoder = new TextEncoder();

function event(type: string, data: unknown): Uint8Array {
  return encoder.encode(`${JSON.stringify({ type, data })}\n`);
}

export async function POST(request: Request) {
  const missing = missingServerVariables();
  if (missing.length > 0) {
    console.error(`AuditScope server configuration missing: ${missing.join(", ")}`);
    return errorResponse({
      code: "SERVER_CONFIGURATION",
      message: "This AuditScope deployment is missing required server configuration.",
      suggestion: "The operator must configure the required Vercel environment variables before verification can run.",
      source: "server",
      retryable: false,
    }, 503);
  }

  let form: FormData;
  try { form = await request.formData(); }
  catch { return errorResponse(invalidRequest("The multipart request could not be read.", "Submit the PDF, network, and address again."), 400); }

  const file = form.get("audit");
  const address = evmAddressSchema.safeParse(form.get("address"));
  const chainId = chainIdSchema.safeParse(Number(form.get("chainId")));
  if (!(file instanceof File) || file.type !== "application/pdf") return errorResponse(invalidRequest("Upload one PDF audit report.", "Choose a file with the PDF media type."), 400);
  if (file.size === 0 || file.size > MAX_PDF_BYTES) return errorResponse(invalidRequest("The PDF must be between 1 byte and 4 MB.", "Vercel functions accept payloads up to 4.5 MB; use a PDF no larger than 4 MB."), 400);
  if (!address.success) return errorResponse(invalidRequest(address.error.issues[0]?.message ?? "Enter a valid EVM address.", "Use a 42-character 0x contract or proxy address."), 400);
  if (!chainId.success) return errorResponse(invalidRequest("Select Base Mainnet or Base Sepolia.", "Choose one of the supported Base networks."), 400);

  const pdf = new Uint8Array(await file.arrayBuffer());
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await verifyAuditCoverage({
          pdf, address: address.data, chainId: chainId.data,
          onStage: (stage) => controller.enqueue(event("stage", stage)),
        });
        controller.enqueue(event("result", result));
      } catch (error) {
        const publicError = publicVerificationError(error);
        console.error(`AuditScope verification stopped [${publicError.code}]`);
        controller.enqueue(event("error", publicError));
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: {
    "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  } });
}

function invalidRequest(message: string, suggestion: string): PublicVerificationError {
  return { code: "INVALID_REQUEST", message, suggestion, source: "request", retryable: false };
}

function errorResponse(error: PublicVerificationError, status: number) {
  return Response.json({ error }, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

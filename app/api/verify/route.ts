import { chainIdSchema, evmAddressSchema } from "@/lib/evidence/schemas";
import { verifyAuditCoverage } from "@/lib/verification/pipeline";

export const maxDuration = 120;
const MAX_PDF_BYTES = 12 * 1024 * 1024;
const encoder = new TextEncoder();

function event(type: string, data: unknown): Uint8Array {
  return encoder.encode(`${JSON.stringify({ type, data })}\n`);
}

export async function POST(request: Request) {
  let form: FormData;
  try { form = await request.formData(); }
  catch { return Response.json({ error: "The multipart request could not be read" }, { status: 400 }); }

  const file = form.get("audit");
  const address = evmAddressSchema.safeParse(form.get("address"));
  const chainId = chainIdSchema.safeParse(Number(form.get("chainId")));
  if (!(file instanceof File) || file.type !== "application/pdf") return Response.json({ error: "Upload one PDF audit report" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_PDF_BYTES) return Response.json({ error: "The PDF must be between 1 byte and 12 MB" }, { status: 400 });
  if (!address.success) return Response.json({ error: address.error.issues[0]?.message }, { status: 400 });
  if (!chainId.success) return Response.json({ error: "Select Base Mainnet or Base Sepolia" }, { status: 400 });

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
        controller.enqueue(event("error", { message: error instanceof Error ? error.message : "Verification failed" }));
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: {
    "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  } });
}

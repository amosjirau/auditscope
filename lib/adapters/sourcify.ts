import { z } from "zod";
import { contentHash } from "../evidence/hash";
import { fetchJson } from "../http";

const sourcifyContractSchema = z.object({
  match: z.enum(["exact_match", "match"]),
  address: z.string(),
  chainId: z.string(),
  sources: z.record(z.string(), z.object({ content: z.string() })).optional().default({}),
  compilation: z.object({ name: z.string().nullable().optional() }).optional(),
  proxyResolution: z.object({
    isProxy: z.boolean(),
    proxyType: z.string().nullable().optional(),
    implementations: z.array(z.object({ address: z.string(), name: z.string().nullable().optional() })),
  }).nullable().optional(),
}).passthrough();

export type SourcifyContract = z.infer<typeof sourcifyContractSchema>;

export async function lookupSourcifyContract(
  chainId: number,
  address: string,
): Promise<SourcifyContract | null> {
  const baseUrl = process.env.SOURCIFY_API_URL ?? "https://sourcify.dev/server";
  return fetchJson({
    service: "Sourcify",
    url: `${baseUrl}/v2/contract/${chainId}/${address}?fields=sources,compilation,proxyResolution`,
    schema: sourcifyContractSchema,
    notFoundAsNull: true,
  });
}

export function sourcifySources(contract: SourcifyContract) {
  return Object.entries(contract.sources).map(([path, source]) => ({
    path,
    content: source.content,
    contentHash: contentHash(source.content),
  }));
}

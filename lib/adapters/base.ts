import { base, baseSepolia } from "viem/chains";
import { createPublicClient, getAddress, http, type Address, type Hex } from "viem";
import {
  deploymentEvidenceSchema,
  type DeploymentEvidence,
  type SupportedChainId,
} from "../evidence/schemas";
import { lookupSourcifyContract, sourcifySources } from "./sourcify";

export const EIP1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as Hex;

function rpcUrl(chainId: SupportedChainId): string {
  return chainId === 8453
    ? process.env.BASE_MAINNET_RPC_URL ?? "https://mainnet.base.org"
    : process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";
}

function addressFromStorage(value?: Hex): Address | null {
  if (!value || /^0x0+$/.test(value)) return null;
  const candidate = `0x${value.slice(-40)}`;
  try {
    return getAddress(candidate);
  } catch {
    return null;
  }
}

export async function lookupDeployment(
  chainId: SupportedChainId,
  addressInput: string,
): Promise<DeploymentEvidence> {
  const address = getAddress(addressInput);
  const chain = chainId === 8453 ? base : baseSepolia;
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl(chainId), { timeout: 12_000, retryCount: 1 }),
  });

  try {
    const [bytecode, sourcify] = await Promise.all([
      client.getBytecode({ address }),
      lookupSourcifyContract(chainId, address),
    ]);
    const hasCode = Boolean(bytecode && bytecode !== "0x");
    if (!hasCode) {
      return deploymentEvidenceSchema.parse({
        chainId, requestedAddress: address, hasCode: false, verificationStatus: "unverified",
        match: null, contractName: null, isProxy: false, proxyType: null,
        implementationAddress: null, proxyResolutionSource: "none", sources: [],
        error: "No contract bytecode exists at this address",
      });
    }

    let implementationAddress: Address | null = null;
    let proxyResolutionSource: "sourcify" | "eip1967" | "none" = "none";
    const sourcifyImplementation = sourcify?.proxyResolution?.implementations[0]?.address;
    if (sourcifyImplementation) {
      try {
        implementationAddress = getAddress(sourcifyImplementation);
        proxyResolutionSource = "sourcify";
      } catch {
        implementationAddress = null;
      }
    }
    if (!implementationAddress) {
      const storage = await client.getStorageAt({ address, slot: EIP1967_IMPLEMENTATION_SLOT });
      implementationAddress = addressFromStorage(storage);
      if (implementationAddress) proxyResolutionSource = "eip1967";
    }

    return deploymentEvidenceSchema.parse({
      chainId,
      requestedAddress: address,
      hasCode,
      verificationStatus: sourcify ? "verified" : "unverified",
      match: sourcify?.match ?? null,
      contractName: sourcify?.compilation?.name ?? null,
      isProxy: Boolean(sourcify?.proxyResolution?.isProxy || implementationAddress),
      proxyType: sourcify?.proxyResolution?.proxyType ?? (implementationAddress ? "EIP-1967/UUPS" : null),
      implementationAddress,
      proxyResolutionSource,
      sources: sourcify ? sourcifySources(sourcify) : [],
      error: sourcify ? null : "Contract has bytecode but is not verified by Sourcify",
    });
  } catch (error) {
    return deploymentEvidenceSchema.parse({
      chainId, requestedAddress: address, hasCode: false, verificationStatus: "error",
      match: null, contractName: null, isProxy: false, proxyType: null,
      implementationAddress: null, proxyResolutionSource: "none", sources: [],
      error: error instanceof Error ? error.message : "Deployment lookup failed",
    });
  }
}

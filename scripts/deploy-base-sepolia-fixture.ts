import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import solc from "solc";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatEther,
  getAddress,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const chainId = 84532;
const sourceRoot = "fixtures/base-sepolia/contracts";
const auditedSourcePath = `${sourceRoot}/VaultV1.sol`;
const proxySourcePath = `${sourceRoot}/AuditScopeProxy.sol`;
const incompleteSourcePath = `${sourceRoot}/IncompleteVault.sol`;
const compilerVersion = "0.8.24+commit.e11b9ed9";

type CompiledContract = { abi: readonly unknown[]; evm: { bytecode: { object: string } } };
type Compilation = {
  stdJsonInput: object;
  contract: CompiledContract;
  contractIdentifier: string;
};

async function main() {
  const [outputPath] = process.argv.slice(2);
  if (!outputPath) throw new Error("Usage: deploy-base-sepolia-fixture.ts <output.json>");
  const privateKey = process.env.BASE_SEPOLIA_FIXTURE_PRIVATE_KEY as Hex | undefined;
  if (!privateKey) throw new Error("BASE_SEPOLIA_FIXTURE_PRIVATE_KEY is required");

  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(rpcUrl) });
  const balance = await publicClient.getBalance({ address: account.address });
  if (balance === 0n) throw new Error(`Fixture deployer ${account.address} has no Base Sepolia ETH`);

  const [v1Content, v2Content, proxyContent, incompleteContent] = await Promise.all([
    readFile(auditedSourcePath, "utf8"),
    readFile(`${sourceRoot}/VaultV2.sol`, "utf8"),
    readFile(proxySourcePath, "utf8"),
    readFile(incompleteSourcePath, "utf8"),
  ]);
  const v1 = compile(auditedSourcePath, v1Content, "VaultV1");
  // Alias V2 to the audited V1 path so exact Sourcify evidence compares the same logical scope path.
  const v2 = compile(auditedSourcePath, v2Content, "VaultV2");
  const proxy = compile(proxySourcePath, proxyContent, "AuditScopeProxy");
  const incomplete = compile(incompleteSourcePath, incompleteContent, "IncompleteVault");

  const deploy = async (compilation: Compilation, args: readonly unknown[] = []) => {
    const transactionHash = await walletClient.deployContract({
      abi: compilation.contract.abi,
      bytecode: `0x${compilation.contract.evm.bytecode.object}`,
      args,
    } as never);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
    if (!receipt.contractAddress) throw new Error(`Deployment ${transactionHash} did not create a contract`);
    return { address: getAddress(receipt.contractAddress), transactionHash, blockNumber: receipt.blockNumber.toString() };
  };

  const initializeV1 = encodeFunctionData({ abi: v1.contract.abi, functionName: "initialize", args: [account.address] });
  const initializeIncomplete = encodeFunctionData({ abi: incomplete.contract.abi, functionName: "initialize", args: [account.address] });

  const currentImplementation = await deploy(v1);
  const currentProxy = await deploy(proxy, [currentImplementation.address, initializeV1]);

  const staleInitialImplementation = await deploy(v1);
  const staleProxy = await deploy(proxy, [staleInitialImplementation.address, initializeV1]);
  const staleImplementation = await deploy(v2);
  const upgradeHash = await walletClient.writeContract({
    address: staleProxy.address,
    abi: v1.contract.abi,
    functionName: "upgradeToAndCall",
    args: [staleImplementation.address, "0x"],
  } as never);
  const upgradeReceipt = await publicClient.waitForTransactionReceipt({ hash: upgradeHash });

  const incompleteImplementation = await deploy(incomplete);
  const partialProxy = await deploy(proxy, [incompleteImplementation.address, initializeIncomplete]);

  const verification = [
    await verify(currentImplementation.address, currentImplementation.transactionHash, v1),
    await verify(staleInitialImplementation.address, staleInitialImplementation.transactionHash, v1),
    await verify(staleImplementation.address, staleImplementation.transactionHash, v2),
    await verify(currentProxy.address, currentProxy.transactionHash, proxy),
    await verify(staleProxy.address, staleProxy.transactionHash, proxy),
    await verify(partialProxy.address, partialProxy.transactionHash, proxy),
  ];
  if (verification.some((entry) => entry.match !== "exact_match")) {
    throw new Error(`Every submitted fixture contract must be exact_match: ${JSON.stringify(verification)}`);
  }

  const result = {
    fixtureVersion: 1,
    generatedAt: new Date().toISOString(),
    chainId,
    deployerAddress: account.address,
    deployerBalanceBefore: formatEther(balance),
    compilerVersion,
    sourceCommit: process.env.AUDIT_SCOPE_SOURCE_COMMIT ?? null,
    current: { implementation: currentImplementation, proxy: currentProxy },
    stale: {
      initialImplementation: staleInitialImplementation,
      implementation: staleImplementation,
      proxy: staleProxy,
      upgradeTransactionHash: upgradeHash,
      upgradeBlockNumber: upgradeReceipt.blockNumber.toString(),
    },
    partial: { implementation: incompleteImplementation, proxy: partialProxy },
    unverified: { address: account.address, reason: "Funded EOA has no contract bytecode" },
    verification,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
}

function compile(sourcePath: string, content: string, contractName: string): Compilation {
  const stdJsonInput = {
    language: "Solidity",
    sources: { [sourcePath]: { content } },
    settings: {
      optimizer: { enabled: false, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(stdJsonInput)));
  const errors = (output.errors ?? []).filter((entry: { severity: string }) => entry.severity === "error");
  if (errors.length) throw new Error(JSON.stringify(errors));
  return {
    stdJsonInput,
    contract: output.contracts[sourcePath][contractName] as CompiledContract,
    contractIdentifier: `${sourcePath}:${contractName}`,
  };
}

async function verify(address: Address, transactionHash: Hex, compilation: Compilation) {
  const response = await fetch(`https://sourcify.dev/server/v2/verify/${chainId}/${address}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stdJsonInput: compilation.stdJsonInput,
      compilerVersion,
      contractIdentifier: compilation.contractIdentifier,
      creationTransactionHash: transactionHash,
    }),
  });
  const submission = await response.json() as { verificationId?: string };
  if (!response.ok || !submission.verificationId) throw new Error(`Sourcify submission failed: ${JSON.stringify(submission)}`);

  for (let attempt = 0; attempt < 45; attempt += 1) {
    const statusResponse = await fetch(`https://sourcify.dev/server/v2/verify/${submission.verificationId}`);
    const status = await statusResponse.json() as {
      isJobCompleted?: boolean;
      verification?: { match?: string };
    };
    if (status.isJobCompleted) {
      const match = status.verification?.match;
      if (!match) throw new Error(`Sourcify verification failed: ${JSON.stringify(status)}`);
      return { address, verificationId: submission.verificationId, match };
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Sourcify verification ${submission.verificationId} timed out`);
}

void main();

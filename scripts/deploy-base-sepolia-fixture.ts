import { readFile, writeFile } from "node:fs/promises";
import solc from "solc";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const chainId = 84532;
const sourceRoot = "fixtures/base-sepolia/contracts";
const compilerVersion = "0.8.24+commit.e11b9ed9";

type CompiledContract = { abi: readonly unknown[]; evm: { bytecode: { object: string } } };

async function main() {
  const [label, outputPath, verificationMode = "all"] = process.argv.slice(2);
  if (!label || !outputPath || !["all", "proxy-only", "none"].includes(verificationMode)) {
    throw new Error("Usage: deploy-base-sepolia-fixture.ts <label> <output.json> [all|proxy-only|none]");
  }
  const privateKey = process.env.BASE_SEPOLIA_FIXTURE_PRIVATE_KEY as Hex | undefined;
  if (!privateKey) throw new Error("BASE_SEPOLIA_FIXTURE_PRIVATE_KEY is required");

  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(rpcUrl) });
  const balance = await publicClient.getBalance({ address: account.address });
  if (balance === 0n) throw new Error(`Fixture deployer ${account.address} has no Base Sepolia ETH`);

  const sources = {
    [`${sourceRoot}/Vault.sol`]: { content: await readFile(`${sourceRoot}/Vault.sol`, "utf8") },
    [`${sourceRoot}/AuditScopeProxy.sol`]: { content: await readFile(`${sourceRoot}/AuditScopeProxy.sol`, "utf8") },
  };
  const stdJsonInput = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: false, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(stdJsonInput)));
  const errors = (output.errors ?? []).filter((entry: { severity: string }) => entry.severity === "error");
  if (errors.length) throw new Error(JSON.stringify(errors));
  const vault = output.contracts[`${sourceRoot}/Vault.sol`].Vault as CompiledContract;
  const proxy = output.contracts[`${sourceRoot}/AuditScopeProxy.sol`].AuditScopeProxy as CompiledContract;

  const deploy = async (contract: CompiledContract, args: readonly unknown[]) => {
    const transactionHash = await walletClient.deployContract({
      abi: contract.abi,
      bytecode: `0x${contract.evm.bytecode.object}`,
      args,
    } as never);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
    if (!receipt.contractAddress) throw new Error(`Deployment ${transactionHash} did not create a contract`);
    return { address: getAddress(receipt.contractAddress), transactionHash, blockNumber: receipt.blockNumber.toString() };
  };

  const implementation = await deploy(vault, []);
  const initialize = encodeFunctionData({
    abi: vault.abi,
    functionName: "initialize",
    args: [account.address],
  });
  const proxyDeployment = await deploy(proxy, [implementation.address, initialize]);

  const verification = [];
  if (verificationMode === "all") {
    verification.push(await verify({ address: implementation.address, transactionHash: implementation.transactionHash, stdJsonInput, contractIdentifier: `${sourceRoot}/Vault.sol:Vault` }));
  }
  if (verificationMode !== "none") {
    verification.push(await verify({ address: proxyDeployment.address, transactionHash: proxyDeployment.transactionHash, stdJsonInput, contractIdentifier: `${sourceRoot}/AuditScopeProxy.sol:AuditScopeProxy` }));
  }
  const result = {
    fixtureVersion: 1,
    label,
    chainId,
    deployerAddress: account.address,
    compilerVersion,
    sourceCommit: process.env.AUDIT_SCOPE_SOURCE_COMMIT ?? null,
    implementation,
    proxy: proxyDeployment,
    verification,
  };
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
}

async function verify(input: {
  address: Address;
  transactionHash: Hex;
  stdJsonInput: object;
  contractIdentifier: string;
}) {
  const response = await fetch(`https://sourcify.dev/server/v2/verify/${chainId}/${input.address}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stdJsonInput: input.stdJsonInput,
      compilerVersion,
      contractIdentifier: input.contractIdentifier,
      creationTransactionHash: input.transactionHash,
    }),
  });
  const submission = await response.json() as { verificationId?: string; error?: string };
  if (!response.ok || !submission.verificationId) throw new Error(`Sourcify submission failed: ${JSON.stringify(submission)}`);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const statusResponse = await fetch(`https://sourcify.dev/server/v2/verify/${submission.verificationId}`);
    const status = await statusResponse.json() as { isJobCompleted?: boolean; verification?: { match?: string }; error?: string };
    if (status.isJobCompleted) {
      if (!status.verification?.match) throw new Error(`Sourcify verification failed: ${JSON.stringify(status)}`);
      return { address: input.address, verificationId: submission.verificationId, match: status.verification.match };
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Sourcify verification ${submission.verificationId} timed out`);
}

void main();

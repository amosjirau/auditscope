import { appendFile } from "node:fs/promises";
import { privateKeyToAccount } from "viem/accounts";
import { generatePrivateKey } from "viem/accounts";

async function main() {
  const existing = process.env.BASE_SEPOLIA_FIXTURE_PRIVATE_KEY;
  const privateKey = existing?.startsWith("0x") ? existing as `0x${string}` : generatePrivateKey();
  if (!existing) {
    await appendFile(".env.local", `\nBASE_SEPOLIA_FIXTURE_PRIVATE_KEY=${privateKey}\n`, { encoding: "utf8", mode: 0o600 });
  }
  const account = privateKeyToAccount(privateKey);
  console.log(JSON.stringify({ address: account.address, created: !existing }, null, 2));
}

void main();

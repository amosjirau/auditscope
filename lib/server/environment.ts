import "server-only";

export const requiredServerVariables = [
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GEMINI_MODEL",
  "GITHUB_TOKEN",
  "BASE_MAINNET_RPC_URL",
  "BASE_SEPOLIA_RPC_URL",
  "SOURCIFY_API_URL",
] as const;

export function missingServerVariables(): string[] {
  return requiredServerVariables.filter((name) => !process.env[name]?.trim());
}

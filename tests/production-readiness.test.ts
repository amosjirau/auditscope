import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const requiredVariables = [
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GEMINI_MODEL",
  "GITHUB_TOKEN",
  "BASE_MAINNET_RPC_URL",
  "BASE_SEPOLIA_RPC_URL",
  "SOURCIFY_API_URL",
];

describe("production readiness boundaries", () => {
  it("documents every server variable without a public or fixture-key entry", async () => {
    const example = await readFile(".env.example", "utf8");
    const configuredNames = example
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split("=", 1)[0]);

    expect(configuredNames).toEqual(requiredVariables);
    expect(configuredNames.every((name) => !name?.startsWith("NEXT_PUBLIC_"))).toBe(true);
    expect(example).not.toContain("BASE_SEPOLIA_FIXTURE_PRIVATE_KEY");
  });

  it("ships the controlled PDF and wires both presets to the production endpoint", async () => {
    const [pdf, workspace] = await Promise.all([
      readFile("public/demo/AuditScope-Test-Scope-Report.pdf"),
      readFile("app/verify-workspace.tsx", "utf8"),
    ]);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(workspace).toContain("/api/verify");
    expect(workspace).toContain("0xC7A79CD13dda7967588549a83110012DCc395266");
    expect(workspace).toContain("0x0Bd5Dd0831139566Dc5166BA74F0891eb44A7b03");
    expect(workspace).not.toContain("validation-results.json");
  });
});

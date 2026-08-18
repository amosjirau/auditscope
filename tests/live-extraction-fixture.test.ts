import { describe, expect, it } from "vitest";
import fixture from "../fixtures/live-extraction/chainsecurity-polkadot-claims-2019.json";
import { auditScopeSchema } from "../lib/evidence/schemas";

describe("sanitized live Gemini extraction fixture", () => {
  it("remains schema-valid and preserves the ground-truth extraction checks", () => {
    const scope = auditScopeSchema.parse(fixture.scope);
    expect(fixture.validation.schemaPassed).toBe(true);
    expect(fixture.validation.allChecksPassed).toBe(true);
    expect(Object.values(fixture.validation.checks).every(Boolean)).toBe(true);
    expect(scope.repositoryUrl.value).toBe("https://github.com/w3f/polkadot-claims");
    expect(scope.commitSha.value).toBeNull();
    expect(scope.tag.value).toBeNull();
    expect(scope.sourceFiles.map((file) => file.path)).toEqual(["./Claims.sol"]);
    expect(scope.contractAddresses.value).toBeNull();
    expect(scope.implementationAddresses.value).toBeNull();
    expect(scope.addressIsScopeBoundary.value).toBeNull();
  });
});

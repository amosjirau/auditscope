# AuditScope controlled live validation

Date: 2026-08-18

Status: **complete**. The controlled Base Sepolia fixtures produced CURRENT, STALE, PARTIAL, and UNVERIFIED through the production PDF-to-verdict pipeline. The consecutive reliability gate passed 10/10.

## Integrity of the run

- Pipeline: synthetic PDF -> `extractAuditScope()` -> GitHub -> Base Sepolia RPC -> Sourcify -> deterministic comparison.
- Production implementations were used for every stage. No injected evidence fixture was used.
- Gemini model for the completed gate: `gemini-3.5-flash-lite`, selected from the models returned by the configured Google key.
- Chain: Base Sepolia, chain ID `84532`.
- Public repository: `https://github.com/amosjirau/auditscope`.
- Audited commit: `740eebbb21af164209331eae15e8c9bc2a86ec86`.
- Audited source: `fixtures/base-sepolia/contracts/VaultV1.sol`.
- Synthetic report: `output/pdf/AuditScope-Test-Scope-Report.pdf`.
- Machine-readable deployment and run records: `fixtures/base-sepolia/deployments.json` and `fixtures/base-sepolia/validation-results.json`.
- The JSON writer rejects output containing the configured Gemini key, deployer private key, or GitHub token. No secret is stored in either fixture.

The PDF is prominently titled **AuditScope Test Scope Report** and states that it is a synthetic verification fixture, not a security audit. Gemini extracted the exact repository, full commit SHA, sole in-scope VaultV1 source path, all explicitly printed deployment addresses, and the explicit statement that an address is not the scope boundary. Every non-null critical extracted value retained a page and excerpt citation. The schema accepted the result and `scopeMatchesFixture` was true. No repository, commit, source path, or address absent from the PDF was introduced.

## Base Sepolia evidence

| Fixture | Role | Address | Sourcify |
|---|---|---|---|
| CURRENT | VaultV1 implementation | `0x903C90A8879d54D719Fb1D0De22C105a2f380938` | `exact_match` |
| CURRENT | ERC-1967/UUPS proxy, remains on V1 | `0xC7A79CD13dda7967588549a83110012DCc395266` | `exact_match` |
| STALE | Initial VaultV1 implementation | `0xD0267cb3Cb1F57b4471270304934C06C06F3ec0f` | `exact_match` |
| STALE | Live VaultV2 implementation | `0x99a32A7715D49714D2aba8Ccc57a468B19Be258F` | `exact_match` |
| STALE | ERC-1967/UUPS proxy, upgraded V1 -> V2 | `0x0Bd5Dd0831139566Dc5166BA74F0891eb44A7b03` | `exact_match` |
| PARTIAL | Intentionally unverified implementation | `0x1584AE516269233af9A6dE1E17028D04B93CAE77` | unverified by design |
| PARTIAL | ERC-1967/UUPS proxy | `0x3E14Df03d2e3fEC961DAb781107D446c1AAC365E` | `exact_match` |
| UNVERIFIED | Funded EOA with no bytecode | `0x76D753410be13BF383366a0F566f90c2d1819b67` | not applicable |

For CURRENT, Sourcify resolved the proxy to VaultV1 and returned the exact audited source path. GitHub resolved the report SHA and the historical/live normalized source hashes were equal (`a3834672...` on both sides). For STALE, Sourcify resolved the upgraded proxy to VaultV2 and the normalized source hashes differed (`a3834672...` audited vs `fe796a14...` live), which was the decisive strong mismatch.

## Consecutive reliability gate

Every run independently uploaded the PDF to Gemini and repeated GitHub, RPC, Sourcify, and comparison work. The 65-second inter-run gap protected the provider's per-model quota and is not included in pipeline latency.

| Run | Expected | Actual | Pass | Total ms | Gemini ms | GitHub/Sourcify/RPC errors |
|---:|---|---|:---:|---:|---:|---|
| 1 | CURRENT | CURRENT | yes | 8,278 | 5,529 | none |
| 2 | CURRENT | CURRENT | yes | 7,884 | 5,517 | none |
| 3 | CURRENT | CURRENT | yes | 7,498 | 5,024 | none |
| 4 | CURRENT | CURRENT | yes | 8,679 | 6,134 | none |
| 5 | CURRENT | CURRENT | yes | 8,467 | 5,857 | none |
| 6 | STALE | STALE | yes | 61,336 | 58,658 | none |
| 7 | STALE | STALE | yes | 21,699 | 18,256 | none |
| 8 | STALE | STALE | yes | 7,933 | 5,534 | none |
| 9 | STALE | STALE | yes | 8,136 | 5,071 | none |
| 10 | STALE | STALE | yes | 14,583 | 5,636 | none |

CURRENT averaged 8,161 ms total / 5,612 ms Gemini. STALE averaged 22,737 ms total / 18,631 ms Gemini. All ten returned the expected verdict.

## PARTIAL and UNVERIFIED

| Run | Expected | Actual | Pass | Total ms | Gemini ms | Recorded evidence limitation |
|---:|---|---|:---:|---:|---:|---|
| 11 | PARTIAL | PARTIAL | yes | 27,975 | 25,538 | Contract has bytecode but is not verified by Sourcify |
| 12 | UNVERIFIED | UNVERIFIED | yes | 35,610 | 33,564 | No contract bytecode exists at this address |

PARTIAL retained the independently verified GitHub commit while leaving live source correspondence unresolved. UNVERIFIED retained the historical GitHub evidence but could not establish a live deployment because RPC returned no bytecode. Neither case used a mock or relaxed a verdict rule.

## Provider diagnostics

Initial diagnostic runs on `gemini-3.5-flash` exposed one schema-invalid response, transient DNS/connect failures, and finally the provider's `generate_content_free_tier_requests` limit of 20. The extractor now uses a 120-second per-attempt timeout, bounded fail-closed retries, and provider-directed backoff. The key's API model listing included `gemini-3.5-flash-lite`; a real CURRENT smoke run on that model passed before the official gate. The completed 12-run result used that separately metered model with the same configured key.

The quota response still classifies the project as free tier. Funding a Google account does not prove that this API key's project is attached to paid billing, so that configuration remains an operational issue rather than being hidden by cached extraction.

## Final repository gates

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 5 files and 27 tests.
- `npm run build`: passed with Next.js 16.3.1; `/`, `/_not-found`, and `/api/verify` built successfully.

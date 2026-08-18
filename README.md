# AuditScope

> Audited does not always mean covered.

AuditScope verifies whether a published smart-contract security audit still maps to the exact code running onchain today. It combines citation-bearing AI extraction with independently checkable GitHub, Sourcify, and Base evidence. Deterministic TypeScript rules—not the model—issue CURRENT, PARTIAL, STALE, or UNVERIFIED.

## The problem

An audit covers a bounded historical scope: a repository, commit, source set, and sometimes a deployment address. The live protocol can later be upgraded, redeployed, or become unverifiable while continuing to display the same “audited” badge.

AuditScope answers the narrower, useful question:

**Does this audit still cover the contract code a user reaches today?**

It does not claim that a contract is safe, secure, or free of vulnerabilities.

## The 30-second architecture

```text
Audit PDF
  -> Gemini extracts cited scope claims
  -> Zod rejects malformed or uncited critical values
  -> GitHub resolves the historical commit and source
  -> Base RPC finds bytecode and EIP-1967 implementation state
  -> Sourcify supplies live verification and source evidence
  -> deterministic TypeScript compares exact evidence
  -> CURRENT / PARTIAL / STALE / UNVERIFIED
```

| Layer | Responsible for | Prohibited from |
|---|---|---|
| Gemini | Reading heterogeneous PDFs and extracting explicitly cited scope fields | Setting or influencing the authoritative verdict |
| GitHub / Sourcify / Base RPC | Establishing historical and live evidence | Turning missing evidence into success |
| Deterministic engine | Comparing addresses, commits, and exact verified source | Claiming the contract is secure |

Only Sourcify `exact_match` can make live source correspondence authoritative. Ordinary `match`, missing source, unavailable services, invalid model output, and timeouts remain fail-closed.

## Live Base Sepolia evidence

The public demo uses a clearly labeled synthetic scope report tied to real repository commit `740eebbb21af164209331eae15e8c9bc2a86ec86` and real Base Sepolia deployments.

| Example | Proxy | Live implementation | Deterministic proof |
|---|---|---|---|
| CURRENT | `0xC7A79CD13dda7967588549a83110012DCc395266` | VaultV1 at `0x903C90A8879d54D719Fb1D0De22C105a2f380938` | Audited GitHub source equals Sourcify `exact_match` source |
| STALE | `0x0Bd5Dd0831139566Dc5166BA74F0891eb44A7b03` | VaultV2 at `0x99a32A7715D49714D2aba8Ccc57a468B19Be258F` | Audited VaultV1 source differs from live exact-matched VaultV2 source |

The landing page has one-click CURRENT and STALE examples. A preset only selects the public synthetic PDF and address; it still executes Gemini, GitHub, RPC, Sourcify, and deterministic comparison live. It never injects or returns a fixture verdict.

Deployment metadata is in [`fixtures/base-sepolia/deployments.json`](fixtures/base-sepolia/deployments.json), and the synthetic report is [`public/demo/AuditScope-Test-Scope-Report.pdf`](public/demo/AuditScope-Test-Scope-Report.pdf).

## Reliability result

The controlled production pipeline completed:

- CURRENT: 5/5 consecutive expected verdicts.
- STALE: 5/5 consecutive expected verdicts.
- PARTIAL: expected result with an intentionally unverified implementation.
- UNVERIFIED: expected result for an address with no contract bytecode.
- No injected evidence dependencies and no cached verdicts.

See [`docs/LIVE_VALIDATION.md`](docs/LIVE_VALIDATION.md) and the sanitized [`fixtures/base-sepolia/validation-results.json`](fixtures/base-sepolia/validation-results.json) for addresses, latencies, evidence status, and all run records.

## Run locally

Requirements: Node.js 20+ and a Gemini API key.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Set every variable in `.env.local`:

```dotenv
GOOGLE_GENERATIVE_AI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
GITHUB_TOKEN=
BASE_MAINNET_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
SOURCIFY_API_URL=https://sourcify.dev/server
```

All six values are consumed server-side. Never add a `NEXT_PUBLIC_` prefix. `GEMINI_MODEL` is explicit because AuditScope does not silently switch models. A read-only GitHub token is required for predictable public API limits.

Open `http://localhost:3000`, upload a PDF no larger than 4 MB, select Base Mainnet or Base Sepolia, and enter a contract or proxy address.

## Deploy to Vercel

Import the repository, enable Fluid compute, and set the six variables above for Production and Preview in the Vercel project settings. The verification route uses the Node.js runtime with a 300-second maximum duration. The application caps PDFs at 4 MB to stay below Vercel’s function payload limit.

Do not configure or upload `BASE_SEPOLIA_FIXTURE_PRIVATE_KEY`; fixture contracts are already deployed and no deployer secret is part of the application.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the production checklist and environment-variable table.

## Known limitations

- V1 supports Base Mainnet and Base Sepolia.
- Proxy resolution covers Sourcify-supported proxies and the EIP-1967 implementation slot.
- Source correspondence is exact after newline and trailing-whitespace normalization; it is not semantic similarity.
- Audit PDF citations are retained for inspection, but downstream evidence must corroborate model claims.
- GitHub retrieval is bounded to the first 20 audit-identified source files.
- PDFs are processed in memory and limited to 4 MB on the public Vercel route.
- AuditScope performs coverage verification, not vulnerability scanning or general due diligence.

## Quality gates

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

# AuditScope

**Verify whether a published Web3 security audit still covers the smart contracts running onchain today.**

AuditScope combines AI document understanding with independently checkable repository and blockchain evidence. The final coverage verdict is deterministic rather than an LLM opinion.

## Status
Day-1 P0 implementation. Upload an audit PDF, select Base Mainnet or Base Sepolia, and enter a contract/proxy address to produce an evidence-backed deterministic verdict.

## Run locally

1. Copy `.env.example` to `.env.local` and set `GOOGLE_GENERATIVE_AI_API_KEY`. A `GITHUB_TOKEN` is recommended for public API rate limits.
2. Run `npm install`.
3. Run `npm run dev` and open `http://localhost:3000`.

Quality gates: `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.

## Evidence path

Gemini extracts a citation-bearing scope from the PDF. Sourcify v2 and Base RPC establish live contract and proxy evidence. GitHub independently resolves the audit ref and source files. TypeScript rules—not the model—compare the evidence and set CURRENT, PARTIAL, STALE, or UNVERIFIED.

## Verdicts
- CURRENT
- PARTIAL
- STALE
- UNVERIFIED

## Important
AuditScope verifies audit-to-deployment coverage. It does not determine whether a smart contract is secure or vulnerability-free.
